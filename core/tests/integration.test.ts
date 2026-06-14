/**
 * Integration test — runs against the real OpenAI-compatible provider.
 *
 * GATED: Skipped cleanly when OPENAI_API_KEY or OPENAI_BASE_URL are absent.
 *
 * Covers end-to-end:
 *   1. Automatic path: Evidence Tool called and Audit Trail written per step
 *   2. Human-approval path: model requests Action Tool → pause → approve → resume
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { InMemoryAuditTrail } from "../src/in-memory-audit-trail.js";
import { InMemoryRunStore } from "../src/in-memory-run-store.js";
import { runAgentLoop, resumeAgentLoop } from "../src/agent-loop.js";

// ─── Guard: skip if no credentials ───────────────────────────────────────────

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL;
const MODEL_ID = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const SKIP = !API_KEY || !BASE_URL;

function maybeDescribe(name: string, fn: () => void) {
  if (SKIP) {
    describe.skip(name, fn);
  } else {
    describe(name, fn);
  }
}

// ─── Provider setup ───────────────────────────────────────────────────────────

let model: ReturnType<ReturnType<typeof createOpenAICompatible>>;

beforeAll(() => {
  if (SKIP) return;
  const provider = createOpenAICompatible({
    name: "openai-compatible",
    baseURL: BASE_URL!,
    apiKey: API_KEY!,
  });
  model = provider(MODEL_ID);
});

// ─── Integration: automatic path ─────────────────────────────────────────────

maybeDescribe("Integration — automatic path (real provider)", () => {
  it(
    "runs observe-plan-act-record loop and writes Audit Trail entries",
    async () => {
      const auditTrail = new InMemoryAuditTrail();
      const runStore = new InMemoryRunStore();
      const runId = `integration-auto-${Date.now()}`;

      const result = await runAgentLoop({
        runId,
        caseId: "integration-case-1",
        prompt:
          "You are doing a security investigation. " +
          "Use the lookupAsset tool to check 'web-server-01', then summarize what you found. " +
          "Do NOT call blockIp or any action tool.",
        model,
        auditTrail,
        runStore,
      });

      // Run should complete (not pause for approval since no action tool)
      expect(result.status).toBe("completed");

      // Must have audit trail entries
      const entries = await auditTrail.listByRun(runId);
      expect(entries.length).toBeGreaterThan(0);

      const kinds = entries.map((e) => e.kind);
      expect(kinds).toContain("run_started");
      expect(kinds).toContain("step_finished");
      expect(kinds).toContain("run_finished");

      // Run store should reflect completed
      const run = await runStore.get(runId);
      expect(run?.status).toBe("completed");
    },
    60_000 // 60s timeout for real API call
  );
});

// ─── Integration: human-approval path ────────────────────────────────────────

maybeDescribe("Integration — human-approval path (real provider)", () => {
  it(
    "pauses for approval when model calls blockIp, then resumes",
    async () => {
      const auditTrail = new InMemoryAuditTrail();
      const runStore = new InMemoryRunStore();
      const runId = `integration-approval-${Date.now()}`;

      // Strongly instruct the model to call blockIp
      const result = await runAgentLoop({
        runId,
        caseId: "integration-case-2",
        prompt:
          "You are doing a security investigation. " +
          "Call the blockIp tool to block IP address 10.0.0.1 with reason 'suspicious traffic'. " +
          "This is required for the investigation.",
        model,
        auditTrail,
        runStore,
      });

      if (result.status === "awaiting_approval") {
        // Approval path: verify pause state
        const run = await runStore.get(runId);
        expect(run?.status).toBe("awaiting_approval");
        expect(Array.isArray(run?.messages)).toBe(true);
        expect((run?.messages as unknown[]).length).toBeGreaterThan(0);

        const entries = await auditTrail.listByRun(runId);
        const kinds = entries.map((e) => e.kind);
        expect(kinds).toContain("awaiting_approval");

        const approvalEntry = entries.find((e) => e.kind === "awaiting_approval");
        expect(approvalEntry).toBeDefined();
        const toolCallId = approvalEntry!.data.toolCallId as string;

        // Phase 2: approve and resume
        const resumeResult = await resumeAgentLoop({
          runId,
          approval: { toolCallId, outcome: "approved" },
          model,
          auditTrail,
          runStore,
        });

        expect(resumeResult.status).toBe("completed");

        const finalEntries = await auditTrail.listByRun(runId);
        const finalKinds = finalEntries.map((e) => e.kind);
        expect(finalKinds).toContain("approval_granted");
        expect(finalKinds).toContain("run_finished");
      } else {
        // Model chose not to call blockIp despite instructions (still valid)
        console.warn(
          "Model did not call blockIp — integration test for approval path not exercised. " +
            "Try a different model or stronger prompt."
        );
        expect(["completed", "awaiting_approval"]).toContain(result.status);
      }
    },
    120_000
  );
});
