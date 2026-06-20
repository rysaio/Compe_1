/**
 * Agent Loop — unit tests (no network).
 *
 * Covers:
 *  1. Automatic path: ToolLoopAgent + onStepFinish Audit Trail writes
 *  2. Human-approval path: approval-request detection, resume with second generateText
 *  3. Approval routing: tool needsApproval flag determines path
 */
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAuditTrail } from "../src/in-memory-audit-trail.js";
import { InMemoryRunStore } from "../src/in-memory-run-store.js";
import { InMemoryPreconditionMarkerStore } from "../src/precondition-marker-store.js";
import { runAgentLoop } from "../src/agent-loop.js";
import { DEFAULT_PRECONDITION_TABLE } from "../src/tools.js";
import { createFakeModel } from "./fake-model.js";

const CASE_ID = "case-unit-001";

function makeRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Automatic path ───────────────────────────────────────────────────────────

describe("Agent Loop — automatic path", () => {
  let auditTrail: InMemoryAuditTrail;
  let runStore: InMemoryRunStore;
  let markerStore: InMemoryPreconditionMarkerStore;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrail();
    runStore = new InMemoryRunStore();
    markerStore = new InMemoryPreconditionMarkerStore();
  });

  it("writes run_started and run_finished audit entries", async () => {
    const model = createFakeModel([
      { text: "Investigation complete.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Investigate alert on host-1",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const entries = await auditTrail.listByRun(runId);
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toContain("run_started");
    expect(kinds).toContain("run_finished");
  });

  it("writes a step_finished entry for each model step", async () => {
    // Two steps: first step calls a tool, second step finishes
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-1", toolName: "lookupAsset", args: { hostname: "host-1" } },
        ],
        finishReason: "tool-calls",
      },
      { text: "Asset is online.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Check host-1",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const entries = await auditTrail.listByRun(runId);
    const stepEntries = entries.filter((e) => e.kind === "step_finished");
    expect(stepEntries.length).toBeGreaterThanOrEqual(2);
  });

  it("run status transitions to completed on success", async () => {
    const model = createFakeModel([
      { text: "Done.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Investigate",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const run = await runStore.get(runId);
    expect(run?.status).toBe("completed");
  });

  it("audit entry data includes useful step info", async () => {
    const model = createFakeModel([
      { text: "Analysis complete.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Analyse",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const entries = await auditTrail.listByRun(runId);
    const stepEntry = entries.find((e) => e.kind === "step_finished");
    expect(stepEntry).toBeDefined();
    expect(stepEntry!.data).toHaveProperty("stepIndex");
  });
});

// ─── Human-approval path ──────────────────────────────────────────────────────

describe("Agent Loop — human-approval path", () => {
  let auditTrail: InMemoryAuditTrail;
  let runStore: InMemoryRunStore;
  let markerStore: InMemoryPreconditionMarkerStore;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrail();
    runStore = new InMemoryRunStore();
    markerStore = new InMemoryPreconditionMarkerStore();
  });

  it("pauses run when model requests an action tool (needsApproval=true)", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-action-1", toolName: "blockIp", args: { ip: "1.2.3.4", reason: "C2" } },
        ],
        finishReason: "tool-calls",
      },
    ]);

    const runId = makeRunId();
    const result = await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Block suspicious IP",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    expect(result.status).toBe("awaiting_approval");

    // Run store reflects paused status
    const run = await runStore.get(runId);
    expect(run?.status).toBe("awaiting_approval");
  });

  it("writes awaiting_approval audit entry when action tool is requested", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-action-2", toolName: "blockIp", args: { ip: "5.6.7.8", reason: "scan" } },
        ],
        finishReason: "tool-calls",
      },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Block scan source",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const entries = await auditTrail.listByRun(runId);
    const approvalEntry = entries.find((e) => e.kind === "awaiting_approval");
    expect(approvalEntry).toBeDefined();
    expect(approvalEntry!.data).toHaveProperty("toolCallId");
    expect(approvalEntry!.data.toolCallId).toBe("tc-action-2");
  });

  it("persists messages so the run can be resumed", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-action-3", toolName: "blockIp", args: { ip: "9.10.11.12", reason: "brute" } },
        ],
        finishReason: "tool-calls",
      },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Block brute-forcer",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const run = await runStore.get(runId);
    expect(run?.messages).toBeDefined();
    expect(Array.isArray(run?.messages)).toBe(true);
    expect((run?.messages as unknown[]).length).toBeGreaterThan(0);
  });

  it("resumes and completes after approval is granted", async () => {
    // First call: model requests action tool
    // Second call (resume): model completes after tool result is provided
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-resume-1", toolName: "blockIp", args: { ip: "1.1.1.1", reason: "test" } },
        ],
        finishReason: "tool-calls",
      },
      { text: "IP blocked successfully.", finishReason: "stop" },
    ]);

    const runId = makeRunId();

    // Phase 1: initial run → pauses for approval
    const pauseResult = await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Block 1.1.1.1",
      model,
      auditTrail,
      runStore,
      markerStore,
    });
    expect(pauseResult.status).toBe("awaiting_approval");

    // Phase 2: operator grants approval → resume
    const { resumeAgentLoop } = await import("../src/agent-loop.js");
    const resumeResult = await resumeAgentLoop({
      runId,
      approval: {
        toolCallId: "tc-resume-1",
        outcome: "approved",
      },
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    expect(resumeResult.status).toBe("completed");

    const run = await runStore.get(runId);
    expect(run?.status).toBe("completed");
  });

  it("writes approval_granted and run_finished entries after resume", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-resume-2", toolName: "blockIp", args: { ip: "2.2.2.2", reason: "test" } },
        ],
        finishReason: "tool-calls",
      },
      { text: "Blocked.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Block 2.2.2.2",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const { resumeAgentLoop } = await import("../src/agent-loop.js");
    await resumeAgentLoop({
      runId,
      approval: { toolCallId: "tc-resume-2", outcome: "approved" },
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const entries = await auditTrail.listByRun(runId);
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toContain("approval_granted");
    expect(kinds).toContain("run_finished");
  });

  it("handles denial — run finishes with denial recorded", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-denied-1", toolName: "blockIp", args: { ip: "3.3.3.3", reason: "test" } },
        ],
        finishReason: "tool-calls",
      },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Block 3.3.3.3",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const { resumeAgentLoop } = await import("../src/agent-loop.js");
    const result = await resumeAgentLoop({
      runId,
      approval: { toolCallId: "tc-denied-1", outcome: "denied" },
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    expect(result.status).toBe("completed");

    const entries = await auditTrail.listByRun(runId);
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toContain("approval_denied");
  });
});

// ─── Audit records tool evidence ──────────────────────────────────────────────
// Per CONTEXT.md, the Audit Trail is the durable record of "evidence gathered ...
// actions executed". A step_finished entry names the tools but not the evidence;
// these tests pin the contract that the trail also records each tool call's input
// and result.

describe("Agent Loop — audit records tool evidence", () => {
  let auditTrail: InMemoryAuditTrail;
  let runStore: InMemoryRunStore;
  let markerStore: InMemoryPreconditionMarkerStore;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrail();
    runStore = new InMemoryRunStore();
    markerStore = new InMemoryPreconditionMarkerStore();
  });

  it("records a tool_called entry naming the evidence tool the model invoked", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-ev-1", toolName: "lookupAsset", args: { hostname: "host-1" } },
        ],
        finishReason: "tool-calls",
      },
      { text: "Asset is online.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Check host-1",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const called = (await auditTrail.listByRun(runId)).filter(
      (e) => e.kind === "tool_called"
    );
    expect(called.length).toBeGreaterThanOrEqual(1);
    expect(called[0].data.toolName).toBe("lookupAsset");
  });

  it("records a tool_result entry carrying the evidence the tool returned", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-ev-2", toolName: "lookupAsset", args: { hostname: "host-2" } },
        ],
        finishReason: "tool-calls",
      },
      { text: "Done.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Check host-2",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const results = (await auditTrail.listByRun(runId)).filter(
      (e) => e.kind === "tool_result"
    );
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].data.toolName).toBe("lookupAsset");
    // The actual evidence the stub returned must be in the trail, not just the name.
    expect(results[0].data.output).toMatchObject({ status: "online" });
  });
});

// ─── Classic generic tools ─────────────────────────────────────────────────────
// The classic tools (calculator, getWeather) exercise the general agent layer
// (ADR 0004) as flat peers of the security stubs. These pin their deterministic
// behaviour and that their results reach the Audit Trail like any other tool.

describe("Agent Loop — classic generic tools", () => {
  let auditTrail: InMemoryAuditTrail;
  let runStore: InMemoryRunStore;
  let markerStore: InMemoryPreconditionMarkerStore;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrail();
    runStore = new InMemoryRunStore();
    markerStore = new InMemoryPreconditionMarkerStore();
  });

  it("runs calculator automatically and records the computed result", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-calc-1", toolName: "calculator", args: { operation: "add", a: 2, b: 3 } },
        ],
        finishReason: "tool-calls",
      },
      { text: "2 + 3 = 5.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    const result = await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "What is 2 + 3?",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    // calculator omits needsApproval → automatic, run completes without pausing.
    expect(result.status).toBe("completed");

    const results = (await auditTrail.listByRun(runId)).filter(
      (e) => e.kind === "tool_result"
    );
    const calc = results.find((e) => e.data.toolName === "calculator");
    expect(calc).toBeDefined();
    expect(calc!.data.output).toMatchObject({ result: 5 });
  });

  it("records the division-by-zero guard result rather than throwing", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-calc-2", toolName: "calculator", args: { operation: "divide", a: 1, b: 0 } },
        ],
        finishReason: "tool-calls",
      },
      { text: "Cannot divide by zero.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    const result = await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Divide 1 by 0",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    expect(result.status).toBe("completed");

    const results = (await auditTrail.listByRun(runId)).filter(
      (e) => e.kind === "tool_result"
    );
    const calc = results.find((e) => e.data.toolName === "calculator");
    expect(calc).toBeDefined();
    expect(calc!.data.output).toMatchObject({ result: null, error: "division by zero" });
  });

  it("runs getWeather automatically and records its stub reading", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-weather-1", toolName: "getWeather", args: { city: "Berlin" } },
        ],
        finishReason: "tool-calls",
      },
      { text: "It is clear in Berlin.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Weather in Berlin?",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const results = (await auditTrail.listByRun(runId)).filter(
      (e) => e.kind === "tool_result"
    );
    const weather = results.find((e) => e.data.toolName === "getWeather");
    expect(weather).toBeDefined();
    expect(weather!.data.output).toMatchObject({ city: "Berlin", conditions: "clear" });
  });
});

// ─── Audit records approved action results ──────────────────────────────────────
// CONTEXT.md defines the Audit Trail as the record of "actions executed". When an
// approval tool is approved and resumed, the SDK executes it in the continuation
// BEFORE the step loop, so its result never reaches onStepFinish.toolResults. The
// trail must still record that execution's tool_result.

describe("Agent Loop — audit records approved action results", () => {
  let auditTrail: InMemoryAuditTrail;
  let runStore: InMemoryRunStore;
  let markerStore: InMemoryPreconditionMarkerStore;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrail();
    runStore = new InMemoryRunStore();
    markerStore = new InMemoryPreconditionMarkerStore();
  });

  it("records a tool_result for an approved action tool after resume", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          {
            toolCallId: "tc-email-1",
            toolName: "sendEmail",
            args: { to: "ops@example.com", subject: "Alert", body: "Investigating." },
          },
        ],
        finishReason: "tool-calls",
      },
      { text: "Email sent.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    const pause = await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Email ops@example.com about the alert",
      model,
      auditTrail,
      runStore,
      markerStore,
    });
    expect(pause.status).toBe("awaiting_approval");

    const { resumeAgentLoop } = await import("../src/agent-loop.js");
    await resumeAgentLoop({
      runId,
      approval: { toolCallId: "tc-email-1", outcome: "approved" },
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const results = (await auditTrail.listByRun(runId)).filter(
      (e) => e.kind === "tool_result"
    );
    const email = results.find((e) => e.data.toolName === "sendEmail");
    expect(email).toBeDefined();
    expect(email!.data.output).toMatchObject({ sent: true, to: "ops@example.com" });
  });

  it("records exactly one tool_result per executed tool (no duplicates)", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          { toolCallId: "tc-look-1", toolName: "lookupAsset", args: { hostname: "host-9" } },
        ],
        finishReason: "tool-calls",
      },
      { text: "Asset checked.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Check host-9",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    const results = (await auditTrail.listByRun(runId)).filter(
      (e) =>
        e.kind === "tool_result" &&
        (e.data as { toolCallId?: string }).toolCallId === "tc-look-1"
    );
    expect(results).toHaveLength(1);
  });
});
