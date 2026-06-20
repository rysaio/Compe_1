/**
 * Agent Loop — observe-plan-act-record core.
 *
 * Two execution paths (per spec):
 *
 * AUTOMATIC PATH (Evidence Tools, needsApproval omitted):
 *   generateText() with onStepFinish → writes one AuditTrail entry per step.
 *   The SDK handles the multi-step tool-calling loop.
 *
 * HUMAN-APPROVAL PATH (Action Tools, needsApproval: true):
 *   generateText() is called once; the SDK detects needsApproval and emits a
 *   "tool-approval-request" part in the assistant message instead of executing
 *   the tool. The harness detects this, persists response.messages, marks the
 *   run awaiting_approval, and returns.
 *   When the operator approves, resumeAgentLoop() appends a tool-approval-response
 *   message and calls generateText() a second time to complete the run.
 *
 * ToolLoopAgent approval-resume is undocumented in SDK v6 — the spec mandates
 * generateText for the human path.
 *
 * Terms follow CONTEXT.md exactly:
 *   Agent Loop, Agent Run, Audit Trail, Evidence Tools, Action Executors, Policy Gate.
 */
import { generateText, isLoopFinished, stepCountIs, type ModelMessage } from "ai";
import type { AuditTrail } from "./audit-trail.js";
import type { RunStore, RunStatus } from "./run-store.js";
import type { PreconditionTable } from "./precondition.js";
import { isPreconditionUnmet } from "./precondition.js";
import type { PreconditionMarkerStore } from "./precondition-marker-store.js";
import { allTools, wrapAllTools, DEFAULT_PRECONDITION_TABLE } from "./tools.js";

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Any object that implements the AI SDK LanguageModel interface (v2 or v3).
 * Using a loose type here to keep tests free from specific provider type imports.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LanguageModel = any;

export interface RunAgentLoopOptions {
  runId: string;
  caseId: string;
  /** The operator prompt / Wake Gate signal that starts this run. */
  prompt: string;
  model: LanguageModel;
  auditTrail: AuditTrail;
  runStore: RunStore;
  /** Precondition marker store (scoped to case, survives across runs). */
  markerStore: PreconditionMarkerStore;
  /** Precondition table (config-as-data). Defaults to DEFAULT_PRECONDITION_TABLE. */
  preconditionTable?: PreconditionTable;
  /** Max steps before the loop self-terminates (default 20). */
  maxSteps?: number;
}

export interface RunResult {
  runId: string;
  status: RunStatus;
}

export interface ApprovalDecision {
  toolCallId: string;
  outcome: "approved" | "denied";
}

export interface ResumeAgentLoopOptions {
  runId: string;
  approval: ApprovalDecision;
  model: LanguageModel;
  auditTrail: AuditTrail;
  runStore: RunStore;
  /** Precondition marker store (scoped to case, survives across runs). */
  markerStore: PreconditionMarkerStore;
  /** Precondition table (config-as-data). Defaults to DEFAULT_PRECONDITION_TABLE. */
  preconditionTable?: PreconditionTable;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a precise, helpful agent running inside a bounded agent loop.
Use the available tools when they help answer the request. Some tools require human
approval before they run; call them when appropriate and the harness will pause for
approval. Be concise and explain your reasoning.`;

// ─── Pending-approval detection ───────────────────────────────────────────────

interface PendingApproval {
  toolCallId: string;
  toolName: string;
  approvalId: string;
  input: unknown;
}

/** Message content part shape we need to inspect. */
interface ContentPart {
  type: string;
  approvalId?: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
}

/** A persisted conversation message. */
interface PersistedMessage {
  role: string;
  content: ContentPart[];
}

/**
 * Inspect response.messages for a "tool-approval-request" content part.
 * The SDK inserts this into the assistant message when a needsApproval tool
 * is called (instead of executing it). Returns the first pending approval.
 */
function findPendingApproval(
  messages: PersistedMessage[]
): PendingApproval | undefined {
  if (!Array.isArray(messages)) return undefined;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    if (!Array.isArray(msg.content)) continue;

    for (const part of msg.content) {
      if (part.type === "tool-approval-request" && part.approvalId) {
        // Find the matching tool-call for the tool name and input args
        const toolCallPart = msg.content.find(
          (p) => p.type === "tool-call" && p.toolCallId === part.toolCallId
        );
        return {
          toolCallId: part.toolCallId ?? "",
          toolName: toolCallPart?.toolName ?? "",
          approvalId: part.approvalId,
          input: toolCallPart?.input,
        };
      }
    }
  }
  return undefined;
}

// ─── Step finish callback type ────────────────────────────────────────────────

interface StepInfo {
  stepNumber?: number;
  finishReason: string;
  toolCalls?: Array<{ toolCallId: string; toolName: string; input?: unknown }>;
  text?: string;
  usage?: unknown;
}

/**
 * Minimal shape of the AI SDK v6 `OnToolCallFinishEvent` we record from. The SDK
 * fires `experimental_onToolCallFinish` after EVERY tool execution — automatic
 * tools run inside the step loop AND approved tools run in the resume
 * continuation — so it, not onStepFinish, is the single source of tool_result.
 * Discriminated on `success`: a failed execution carries `error`, not `output`.
 */
interface ToolCallFinishEvent {
  stepNumber?: number;
  toolCall: { toolCallId: string; toolName: string; input?: unknown };
  success: boolean;
  output?: unknown;
  error?: unknown;
}

/** Default step cap for one generateText loop (initial run and resume alike). */
const DEFAULT_MAX_STEPS = 20;

/**
 * Writes the Audit Trail records for one completed step: a step_finished
 * summary plus a tool_called entry for every tool the model invoked — the
 * evidence gathered and actions requested (CONTEXT.md: Audit Trail), not just
 * step boundaries. Tool RESULTS are recorded separately by recordToolResult
 * (see below): approved action tools execute in the resume continuation, which
 * never reaches onStepFinish, so tool_result cannot be sourced from here.
 * `label` distinguishes initial-run steps from resume steps.
 */
async function recordStep(
  auditTrail: AuditTrail,
  runId: string,
  step: StepInfo,
  label: string | number
): Promise<void> {
  await auditTrail.append({
    runId,
    kind: "step_finished",
    data: {
      stepIndex: label,
      finishReason: step.finishReason,
      toolCalls: step.toolCalls?.map((tc) => ({
        id: tc.toolCallId,
        name: tc.toolName,
      })),
      text: step.text,
    },
  });
  for (const tc of step.toolCalls ?? []) {
    await auditTrail.append({
      runId,
      kind: "tool_called",
      data: { toolCallId: tc.toolCallId, toolName: tc.toolName, input: tc.input },
    });
  }
}

/**
 * Writes one tool_result entry per completed tool EXECUTION. Fired by
 * experimental_onToolCallFinish, so it captures automatic tools and approved
 * action tools alike — including approvals executed in the resume continuation
 * that bypass onStepFinish (the audit-trail gap this fixes).
 *
 * Detects precondition_unmet outputs and records them with the
 * "precondition_unmet" kind (ADR 0005: the Audit Trail mirrors marker
 * transitions; a blocked call is a transition worth recording).
 *
 * A failed execution records its `error` instead of `output`.
 */
async function recordToolResult(
  auditTrail: AuditTrail,
  runId: string,
  event: ToolCallFinishEvent
): Promise<void> {
  if (event.success && isPreconditionUnmet(event.output)) {
    await auditTrail.append({
      runId,
      kind: "precondition_unmet",
      data: {
        toolCallId: event.toolCall.toolCallId,
        toolName: event.toolCall.toolName,
        guidance: event.output,
      },
    });
    return;
  }

  await auditTrail.append({
    runId,
    kind: "tool_result",
    data: event.success
      ? {
          toolCallId: event.toolCall.toolCallId,
          toolName: event.toolCall.toolName,
          output: event.output,
        }
      : {
          toolCallId: event.toolCall.toolCallId,
          toolName: event.toolCall.toolName,
          error: String(event.error),
        },
  });
}

// ─── Main agent loop implementation ──────────────────────────────────────────

/**
 * Runs ONE generateText call that includes BOTH Evidence and Action tools.
 * If the model calls an Action Tool (needsApproval: true), the SDK stops
 * the loop and records a tool-approval-request in the messages.
 *
 * Tools are wrapped with precondition checks (ADR 0005) before the call.
 */
async function runWithApprovalCheck(opts: RunAgentLoopOptions): Promise<{
  finishReason: string;
  /** SDK response messages (for persisting and resuming). */
  responseMessages: PersistedMessage[];
  pendingApproval?: PendingApproval;
}> {
  const {
    prompt,
    model,
    auditTrail,
    runId,
    caseId,
    markerStore,
    preconditionTable = DEFAULT_PRECONDITION_TABLE,
    maxSteps = DEFAULT_MAX_STEPS,
  } = opts;

  // Wrap tools with precondition checks scoped to this case
  const tools = wrapAllTools(allTools, preconditionTable, markerStore, caseId);

  const result = await generateText({
    model,
    tools,
    system: SYSTEM_PROMPT,
    prompt,
    // isLoopFinished() lets the SDK multi-step until the model says "stop".
    // stepCountIs(maxSteps) is the safety cap.
    stopWhen: [isLoopFinished(), stepCountIs(maxSteps)],
    onStepFinish: (step: StepInfo) =>
      recordStep(auditTrail, runId, step, step.stepNumber ?? 0),
    experimental_onToolCallFinish: (event: ToolCallFinishEvent) =>
      recordToolResult(auditTrail, runId, event),
  });

  // Messages are in result.response.messages (SDK v6 API)
  const responseMessages: PersistedMessage[] =
    (result.response?.messages as PersistedMessage[] | undefined) ?? [];
  const pendingApproval = findPendingApproval(responseMessages);

  return {
    finishReason: result.finishReason,
    responseMessages,
    pendingApproval,
  };
}

// ─── Public: runAgentLoop ─────────────────────────────────────────────────────

/**
 * Entry point for one Agent Run.
 *
 * Starts the bounded observe-plan-act-record loop.
 * Returns immediately with status="awaiting_approval" if an Action Tool is
 * requested; the run stays persisted in RunStore for resumeAgentLoop().
 */
export async function runAgentLoop(
  opts: RunAgentLoopOptions
): Promise<RunResult> {
  const { runId, caseId, auditTrail, runStore } = opts;

  // Create run record
  await runStore.create({
    id: runId,
    caseId,
    status: "running",
    messages: [],
  });

  // Record run start
  await auditTrail.append({
    runId,
    kind: "run_started",
    data: { caseId, prompt: opts.prompt },
  });

  try {
    const loopResult = await runWithApprovalCheck(opts);

    if (loopResult.pendingApproval) {
      // Pause: persist response messages, mark awaiting_approval
      await runStore.update(runId, {
        status: "awaiting_approval",
        messages: loopResult.responseMessages,
      });

      await auditTrail.append({
        runId,
        kind: "awaiting_approval",
        data: {
          toolCallId: loopResult.pendingApproval.toolCallId,
          toolName: loopResult.pendingApproval.toolName,
          approvalId: loopResult.pendingApproval.approvalId,
        },
      });

      return { runId, status: "awaiting_approval" };
    }

    // Normal completion
    await runStore.update(runId, {
      status: "completed",
      messages: loopResult.responseMessages,
    });
    await auditTrail.append({
      runId,
      kind: "run_finished",
      data: { finishReason: loopResult.finishReason },
    });

    return { runId, status: "completed" };
  } catch (err) {
    await runStore.update(runId, { status: "failed" });
    await auditTrail.append({
      runId,
      kind: "run_finished",
      data: { error: String(err) },
    });
    throw err;
  }
}

// ─── Public: resumeAgentLoop ──────────────────────────────────────────────────

/**
 * Resumes a paused Agent Run after an operator approves or denies the action.
 *
 * Implements the SDK pattern: append a tool-approval-response message to the
 * persisted history, then call generateText() a second time.
 *
 * The tool-approval-response uses `approvalId` (not toolCallId) to link back
 * to the tool-approval-request. The SDK will then execute the approved tool
 * and resume the model conversation.
 *
 * ADR 0005: On approval, writes the `approved:<toolName>` precondition marker
 * so the Precondition Table check inside the execute wrapper passes. The
 * Policy Gate is a row in the Precondition Table — this is the write side.
 *
 * This is at the SDK messages layer — the Job layer (pg-boss) is deferred
 * per spec.
 */
export async function resumeAgentLoop(
  opts: ResumeAgentLoopOptions
): Promise<RunResult> {
  const {
    runId,
    approval,
    model,
    auditTrail,
    runStore,
    markerStore,
    preconditionTable = DEFAULT_PRECONDITION_TABLE,
  } = opts;

  const run = await runStore.get(runId);
  if (!run) throw new Error(`AgentRun not found: ${runId}`);
  if (run.status !== "awaiting_approval") {
    throw new Error(
      `AgentRun ${runId} is not awaiting_approval (status: ${run.status})`
    );
  }

  // Find the approvalId from persisted messages for the SDK response link.
  const persistedMessages = run.messages as PersistedMessage[];
  const pending = findPendingApproval(persistedMessages);

  if (!pending) {
    throw new Error(
      `No pending tool-approval-request found in run ${runId} messages`
    );
  }
  if (pending.toolCallId !== approval.toolCallId) {
    throw new Error(
      `Approval toolCallId mismatch for run ${runId}: expected ${pending.toolCallId}, got ${approval.toolCallId}`
    );
  }

  if (approval.outcome === "denied") {
    // Denial: no second model call; record and close
    await runStore.update(runId, { status: "completed" });
    await auditTrail.append({
      runId,
      kind: "approval_denied",
      data: { toolCallId: approval.toolCallId },
    });
    await auditTrail.append({
      runId,
      kind: "run_finished",
      data: { reason: "action_denied" },
    });
    return { runId, status: "completed" };
  }

  // Approval granted — record it
  await auditTrail.append({
    runId,
    kind: "approval_granted",
    data: { toolCallId: approval.toolCallId },
  });

  // ADR 0005: Write the approved:<toolName> precondition marker.
  // The execute wrapper checks this marker against the Precondition Table
  // before allowing the real tool to execute. This is the Policy Gate
  // unified under the precondition shape.
  await markerStore.add(run.caseId, `approved:${pending.toolName}`);

  // Append tool-approval-response — SDK matches by approvalId
  // When the SDK processes this on the second generateText call, it will:
  // 1. Execute the approved tool using its `execute` function
  // 2. Resume the model conversation with the tool result
  const approvalResponseMsg = {
    role: "tool" as const,
    content: [
      {
        type: "tool-approval-response" as "tool-result",
        approvalId: pending.approvalId,
        approved: true,
      },
    ],
  };

  const resumeMessages: ModelMessage[] = [
    ...(persistedMessages as ModelMessage[]),
    approvalResponseMsg as unknown as ModelMessage,
  ];

  // Wrap tools with precondition checks scoped to this case
  const tools = wrapAllTools(allTools, preconditionTable, markerStore, run.caseId);

  const result = await generateText({
    model,
    tools,
    system: SYSTEM_PROMPT,
    messages: resumeMessages,
    stopWhen: [isLoopFinished(), stepCountIs(DEFAULT_MAX_STEPS)],
    onStepFinish: (step: StepInfo) =>
      recordStep(auditTrail, runId, step, `resume-${step.stepNumber ?? 0}`),
    experimental_onToolCallFinish: (event: ToolCallFinishEvent) =>
      recordToolResult(auditTrail, runId, event),
  });

  const finalMessages =
    (result.response?.messages as PersistedMessage[] | undefined) ?? resumeMessages;

  await runStore.update(runId, {
    status: "completed",
    messages: finalMessages,
  });

  await auditTrail.append({
    runId,
    kind: "run_finished",
    data: { finishReason: result.finishReason, resumed: true },
  });

  return { runId, status: "completed" };
}
