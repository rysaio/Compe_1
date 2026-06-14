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
import { runAgentLoop } from "../src/agent-loop.js";
import { createFakeModel } from "./fake-model.js";

const CASE_ID = "case-unit-001";

function makeRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Automatic path ───────────────────────────────────────────────────────────

describe("Agent Loop — automatic path", () => {
  let auditTrail: InMemoryAuditTrail;
  let runStore: InMemoryRunStore;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrail();
    runStore = new InMemoryRunStore();
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

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrail();
    runStore = new InMemoryRunStore();
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
    });

    const { resumeAgentLoop } = await import("../src/agent-loop.js");
    await resumeAgentLoop({
      runId,
      approval: { toolCallId: "tc-resume-2", outcome: "approved" },
      model,
      auditTrail,
      runStore,
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
    });

    const { resumeAgentLoop } = await import("../src/agent-loop.js");
    const result = await resumeAgentLoop({
      runId,
      approval: { toolCallId: "tc-denied-1", outcome: "denied" },
      model,
      auditTrail,
      runStore,
    });

    expect(result.status).toBe("completed");

    const entries = await auditTrail.listByRun(runId);
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toContain("approval_denied");
  });
});
