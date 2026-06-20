/**
 * Precondition Gating — tests (ADR 0005).
 *
 * Covers:
 *   1. Pure evaluator: allOf / anyOf / atLeast / nested / empty-rule
 *   2. Marker store: add / has / list / remove / case isolation
 *   3. Execute wrapper: passthrough / blocked / repeatability (AC-3)
 *   4. Agent Loop integration: Policy Gate marker + precondition_unmet audit
 */
import { describe, it, expect, beforeEach } from "vitest";
import { evaluate, generateGuidance, isPreconditionUnmet } from "../src/precondition.js";
import type {
  PreconditionRule,
  PreconditionTable,
  AllOfRule,
  AnyOfRule,
  AtLeastRule,
} from "../src/precondition.js";
import { InMemoryPreconditionMarkerStore } from "../src/precondition-marker-store.js";
import {
  wrapAllTools,
  DEFAULT_PRECONDITION_TABLE,
  calculatorTool,
  blockIpTool,
} from "../src/tools.js";
import type { Tool } from "ai";
import { InMemoryAuditTrail } from "../src/in-memory-audit-trail.js";
import { InMemoryRunStore } from "../src/in-memory-run-store.js";
import { runAgentLoop, resumeAgentLoop } from "../src/agent-loop.js";
import { createFakeModel } from "./fake-model.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CASE_ID = "case-precond-001";

function makeRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Build a minimal stub tool that returns the given value. */
function stubTool(name: string, result: unknown): Tool {
  return {
    description: `Stub ${name}`,
    inputSchema: { _type: "zod" } as unknown as Tool["inputSchema"],
    execute: async () => result,
  } as unknown as Tool;
}

// ─── 1. Evaluator ──────────────────────────────────────────────────────────────

describe("Precondition evaluator", () => {
  it("allOf: ok when all markers present", () => {
    const rule: AllOfRule = { allOf: ["a", "b"] };
    const result = evaluate(rule, new Set(["a", "b", "c"]));
    expect(result.ok).toBe(true);
  });

  it("allOf: blocked when one is missing", () => {
    const rule: AllOfRule = { allOf: ["a", "b"] };
    const result = evaluate(rule, new Set(["a"]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(["b"]);
      expect(result.guidance).toContain("b");
    }
  });

  it("allOf: blocked when all are missing", () => {
    const rule: AllOfRule = { allOf: ["a", "b"] };
    const result = evaluate(rule, new Set<string>());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(["a", "b"]);
    }
  });

  it("anyOf: ok when at least one is present", () => {
    const rule: AnyOfRule = { anyOf: ["a", "b", "c"] };
    const result = evaluate(rule, new Set(["b"]));
    expect(result.ok).toBe(true);
  });

  it("anyOf: blocked when none are present", () => {
    const rule: AnyOfRule = { anyOf: ["a", "b"] };
    const result = evaluate(rule, new Set<string>());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(["a", "b"]);
      expect(result.guidance).toContain("a");
      expect(result.guidance).toContain("b");
    }
  });

  it("atLeast: ok when k markers are present", () => {
    const rule: AtLeastRule = { atLeast: { k: 2, of: ["a", "b", "c"] } };
    const result = evaluate(rule, new Set(["a", "c", "d"]));
    expect(result.ok).toBe(true);
  });

  it("atLeast: blocked when fewer than k are present", () => {
    const rule: AtLeastRule = { atLeast: { k: 2, of: ["a", "b", "c"] } };
    const result = evaluate(rule, new Set(["a"]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing.length).toBeGreaterThanOrEqual(1);
      expect(result.guidance).toContain("2");
    }
  });

  it("atLeast: ok when exactly k are present", () => {
    const rule: AtLeastRule = { atLeast: { k: 2, of: ["a", "b", "c"] } };
    const result = evaluate(rule, new Set(["a", "b"]));
    expect(result.ok).toBe(true);
  });

  it("atLeast: ok when more than k are present", () => {
    const rule: AtLeastRule = { atLeast: { k: 1, of: ["a", "b"] } };
    const result = evaluate(rule, new Set(["a", "b"]));
    expect(result.ok).toBe(true);
  });

  it("nested: allOf with anyOf — ok when inner satisfied", () => {
    // A AND (B OR C)
    const rule: PreconditionRule = {
      allOf: ["called:triage", { anyOf: ["evidence_complete", "analyst_override"] }],
    };
    // A present, C present → ok
    const result = evaluate(
      rule,
      new Set(["called:triage", "analyst_override"])
    );
    expect(result.ok).toBe(true);
  });

  it("nested: allOf with anyOf — blocked when inner unsatisfied", () => {
    // A AND (B OR C)
    const rule: PreconditionRule = {
      allOf: ["called:triage", { anyOf: ["evidence_complete", "analyst_override"] }],
    };
    // A present but neither B nor C → blocked
    const result = evaluate(rule, new Set(["called:triage"]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("evidence_complete");
      expect(result.missing).toContain("analyst_override");
    }
  });

  it("nested: allOf with anyOf — guidance preserves OR semantics", () => {
    const rule: PreconditionRule = {
      allOf: ["called:triage", { anyOf: ["evidence_complete", "analyst_override"] }],
    };
    const result = evaluate(rule, new Set(["called:triage"]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guidance).toContain("其中之一");
      expect(result.guidance).toContain("evidence_complete 或 analyst_override");
      expect(result.guidance).not.toContain("evidence_complete, analyst_override");
    }
  });

  it("nested: deep allOf with atLeast inside", () => {
    // A AND (at least 2 of [B, C, D])
    const rule: PreconditionRule = {
      allOf: ["a", { atLeast: { k: 2, of: ["b", "c", "d"] } }],
    };
    // A present, only B present → blocked (need 2 of 3)
    const result = evaluate(rule, new Set(["a", "b"]));
    expect(result.ok).toBe(false);
    // A present, B and C present → ok
    const result2 = evaluate(rule, new Set(["a", "b", "c"]));
    expect(result2.ok).toBe(true);
  });

  it("nested: allOf with atLeast — guidance preserves k-of-n semantics", () => {
    const rule: PreconditionRule = {
      allOf: ["a", { atLeast: { k: 2, of: ["b", "c", "d"] } }],
    };
    const result = evaluate(rule, new Set(["a", "b"]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guidance).toContain("至少 2 个");
      expect(result.guidance).toContain("[b, c, d]");
    }
  });
});

// ─── 2. Marker store ──────────────────────────────────────────────────────────

describe("Precondition marker store", () => {
  let store: InMemoryPreconditionMarkerStore;

  beforeEach(() => {
    store = new InMemoryPreconditionMarkerStore();
  });

  it("has returns false for unknown marker", async () => {
    expect(await store.has(CASE_ID, "anything")).toBe(false);
  });

  it("has returns false for unknown case", async () => {
    expect(await store.has("no-such-case", "called:triage")).toBe(false);
  });

  it("add then has returns true", async () => {
    await store.add(CASE_ID, "called:triage");
    expect(await store.has(CASE_ID, "called:triage")).toBe(true);
  });

  it("list returns empty for unknown case", async () => {
    expect(await store.list("no-such")).toEqual([]);
  });

  it("list returns all markers for a case", async () => {
    await store.add(CASE_ID, "called:triage");
    await store.add(CASE_ID, "evidence_complete");
    const markers = await store.list(CASE_ID);
    expect(markers).toContain("called:triage");
    expect(markers).toContain("evidence_complete");
    expect(markers).toHaveLength(2);
  });

  it("add is idempotent", async () => {
    await store.add(CASE_ID, "called:triage");
    await store.add(CASE_ID, "called:triage");
    expect(await store.list(CASE_ID)).toEqual(["called:triage"]);
  });

  it("remove deletes a marker", async () => {
    await store.add(CASE_ID, "a");
    await store.add(CASE_ID, "b");
    await store.remove(CASE_ID, "a");
    expect(await store.has(CASE_ID, "a")).toBe(false);
    expect(await store.has(CASE_ID, "b")).toBe(true);
  });

  it("remove of non-existent marker is a no-op", async () => {
    await store.add(CASE_ID, "a");
    await store.remove(CASE_ID, "ghost");
    expect(await store.list(CASE_ID)).toEqual(["a"]);
  });

  it("isolates markers across cases", async () => {
    await store.add("case-A", "called:triage");
    await store.add("case-B", "called:lookupAsset");
    expect(await store.list("case-A")).toEqual(["called:triage"]);
    expect(await store.list("case-B")).toEqual(["called:lookupAsset"]);
  });
});

// ─── 3. Execute wrapper ───────────────────────────────────────────────────────

describe("Execute wrapper", () => {
  let store: InMemoryPreconditionMarkerStore;

  beforeEach(() => {
    store = new InMemoryPreconditionMarkerStore();
  });

  it("passthrough: tool without table entry executes normally", async () => {
    const tools = { stub: stubTool("stub", { done: true }) };
    const wrapped = wrapAllTools(tools, {}, store, CASE_ID);

    const output = await wrapped.stub.execute({});
    expect(output).toEqual({ done: true });
  });

  it("passthrough: tool without entry writes called:<id> marker", async () => {
    const tools = { stub: stubTool("stub", { done: true }) };
    const wrapped = wrapAllTools(tools, {}, store, CASE_ID);

    await wrapped.stub.execute({});
    expect(await store.has(CASE_ID, "called:stub")).toBe(true);
  });

  it("blocks when precondition is unmet (AC-1)", async () => {
    const table: PreconditionTable = {
      action: { rule: { allOf: ["approved:action"] } },
    };
    const tools = { action: stubTool("action", { executed: true }) };
    const wrapped = wrapAllTools(tools, table, store, CASE_ID);

    const output = await wrapped.action.execute({});

    expect(isPreconditionUnmet(output)).toBe(true);
    if (isPreconditionUnmet(output)) {
      expect(output.status).toBe("precondition_unmet");
      expect(output.interface).toBe("action");
      expect(output.missing).toContain("approved:action");
      expect(output.message).toBeTruthy();
    }
  });

  it("does NOT execute real tool when blocked (AC-1)", async () => {
    let called = false;
    const table: PreconditionTable = {
      danger: { rule: { allOf: ["approved:danger"] } },
    };
    const tools = {
      danger: {
        description: "danger",
        inputSchema: { _type: "zod" } as unknown as Tool["inputSchema"],
        execute: async () => {
          called = true;
          return { done: true };
        },
      } as unknown as Tool,
    };
    const wrapped = wrapAllTools(tools, table, store, CASE_ID);

    await wrapped.danger.execute({});
    expect(called).toBe(false);
  });

  it("executes when precondition is met", async () => {
    await store.add(CASE_ID, "approved:action");

    const table: PreconditionTable = {
      action: { rule: { allOf: ["approved:action"] } },
    };
    const tools = { action: stubTool("action", { executed: true }) };
    const wrapped = wrapAllTools(tools, table, store, CASE_ID);

    const output = await wrapped.action.execute({});
    expect(output).toEqual({ executed: true });
  });

  it("writes called:<id> marker after successful execution", async () => {
    await store.add(CASE_ID, "approved:action");

    const table: PreconditionTable = {
      action: { rule: { allOf: ["approved:action"] } },
    };
    const tools = { action: stubTool("action", { done: true }) };
    const wrapped = wrapAllTools(tools, table, store, CASE_ID);

    await wrapped.action.execute({});
    expect(await store.has(CASE_ID, "called:action")).toBe(true);
  });

  it("repeatability: same unmet precondition blocks every time (AC-3)", async () => {
    const table: PreconditionTable = {
      action: { rule: { allOf: ["approved:action"] } },
    };
    const tools = { action: stubTool("action", { executed: true }) };
    const wrapped = wrapAllTools(tools, table, store, CASE_ID);

    // First call — blocked
    const out1 = await wrapped.action.execute({});
    expect(isPreconditionUnmet(out1)).toBe(true);

    // Second call — still blocked (no "second time free")
    const out2 = await wrapped.action.execute({});
    expect(isPreconditionUnmet(out2)).toBe(true);

    // Marker still not set
    expect(await store.has(CASE_ID, "called:action")).toBe(false);
  });

  it("wraps a real tool from allTools: calculator passes through", async () => {
    // calculator has no precondition entry → passthrough
    const wrapped = wrapAllTools(
      { calculator: calculatorTool as unknown as Tool },
      DEFAULT_PRECONDITION_TABLE,
      store,
      CASE_ID
    );

    const output = await wrapped.calculator.execute({
      operation: "add",
      a: 1,
      b: 2,
    });
    expect(output).toMatchObject({ result: 3 });
  });

  it("wraps real blockIpTool: blocks without approved marker", async () => {
    // blockIp has { allOf: ["approved:blockIp"] } in DEFAULT_PRECONDITION_TABLE
    const wrapped = wrapAllTools(
      { blockIp: blockIpTool as unknown as Tool },
      DEFAULT_PRECONDITION_TABLE,
      store,
      CASE_ID
    );

    const output = await wrapped.blockIp.execute({
      ip: "1.2.3.4",
      reason: "test",
    });

    expect(isPreconditionUnmet(output)).toBe(true);
    if (isPreconditionUnmet(output)) {
      expect(output.interface).toBe("blockIp");
      expect(output.missing).toContain("approved:blockIp");
    }
  });
});

// ─── 4. Agent Loop integration ─────────────────────────────────────────────────
// Covers: Policy Gate marker write on approval, precondition_unmet audit trail

describe("Agent Loop — precondition integration", () => {
  let auditTrail: InMemoryAuditTrail;
  let runStore: InMemoryRunStore;
  let markerStore: InMemoryPreconditionMarkerStore;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrail();
    runStore = new InMemoryRunStore();
    markerStore = new InMemoryPreconditionMarkerStore();
  });

  it("writes approved:<toolName> marker when approval is granted (ADR 0005)", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          {
            toolCallId: "tc-block-1",
            toolName: "blockIp",
            args: { ip: "5.5.5.5", reason: "C2" },
          },
        ],
        finishReason: "tool-calls",
      },
      { text: "IP blocked.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    const pause = await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Block 5.5.5.5",
      model,
      auditTrail,
      runStore,
      markerStore,
    });
    expect(pause.status).toBe("awaiting_approval");

    // Before resume: marker should NOT exist yet
    expect(await markerStore.has(CASE_ID, "approved:blockIp")).toBe(false);

    await resumeAgentLoop({
      runId,
      approval: { toolCallId: "tc-block-1", outcome: "approved" },
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    // After resume: marker IS written (Policy Gate unified)
    expect(await markerStore.has(CASE_ID, "approved:blockIp")).toBe(true);
  });

  it("does NOT write approved marker when approval is denied", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          {
            toolCallId: "tc-block-2",
            toolName: "blockIp",
            args: { ip: "6.6.6.6", reason: "test" },
          },
        ],
        finishReason: "tool-calls",
      },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Block 6.6.6.6",
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    await resumeAgentLoop({
      runId,
      approval: { toolCallId: "tc-block-2", outcome: "denied" },
      model,
      auditTrail,
      runStore,
      markerStore,
    });

    expect(await markerStore.has(CASE_ID, "approved:blockIp")).toBe(false);
  });

  it("records precondition_unmet in audit trail when execute blocked", async () => {
    // Force a call to blockIp WITHOUT approval — execute wrapper blocks it
    // The model calls it directly, but since no approval has been granted,
    // the precondition check blocks execution.

    // We need a scenario where the model calls blockIp AND the SDK executes it
    // (not pausing for needsApproval). Since needsApproval: true prevents
    // automatic execution, we use a tool WITHOUT needsApproval but WITH
    // a precondition that's unmet.

    // Build a custom table where a non-approval tool has a precondition
    const table: PreconditionTable = {
      getWeather: { rule: { allOf: ["called:triage"] } },
    };

    const model = createFakeModel([
      {
        toolCalls: [
          {
            toolCallId: "tc-weather-1",
            toolName: "getWeather",
            args: { city: "Berlin" },
          },
        ],
        finishReason: "tool-calls",
      },
      { text: "Done.", finishReason: "stop" },
    ]);

    const runId = makeRunId();
    await runAgentLoop({
      runId,
      caseId: CASE_ID,
      prompt: "Get Berlin weather",
      model,
      auditTrail,
      runStore,
      markerStore,
      preconditionTable: table,
    });

    const entries = await auditTrail.listByRun(runId);
    const blocked = entries.filter((e) => e.kind === "precondition_unmet");
    expect(blocked.length).toBeGreaterThanOrEqual(1);

    const data = blocked[0].data as { toolName?: string; guidance?: unknown };
    expect(data.toolName).toBe("getWeather");
    expect(data.guidance).toBeDefined();
    expect((data.guidance as Record<string, unknown>).status).toBe(
      "precondition_unmet"
    );
  });

  it("called:<id> marker is written when evidence tool succeeds", async () => {
    const model = createFakeModel([
      {
        toolCalls: [
          {
            toolCallId: "tc-lookup-9",
            toolName: "lookupAsset",
            args: { hostname: "host-9" },
          },
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

    expect(await markerStore.has(CASE_ID, "called:lookupAsset")).toBe(true);
  });

  it("marker survives across agent runs (same case)", async () => {
    // Run 1: lookupAsset → called:lookupAsset is written
    const model1 = createFakeModel([
      {
        toolCalls: [
          {
            toolCallId: "tc-lookup-10",
            toolName: "lookupAsset",
            args: { hostname: "host-10" },
          },
        ],
        finishReason: "tool-calls",
      },
      { text: "Done.", finishReason: "stop" },
    ]);

    await runAgentLoop({
      runId: makeRunId(),
      caseId: CASE_ID,
      prompt: "Check host-10",
      model: model1,
      auditTrail,
      runStore,
      markerStore,
    });

    expect(await markerStore.has(CASE_ID, "called:lookupAsset")).toBe(true);

    // Run 2: getWeather with precondition called:triage (still missing, blocks)
    const table: PreconditionTable = {
      getWeather: { rule: { allOf: ["called:triage"] } },
    };

    const model2 = createFakeModel([
      {
        toolCalls: [
          {
            toolCallId: "tc-weather-2",
            toolName: "getWeather",
            args: { city: "Paris" },
          },
        ],
        finishReason: "tool-calls",
      },
      { text: "Done.", finishReason: "stop" },
    ]);

    const runId2 = makeRunId();
    await runAgentLoop({
      runId: runId2,
      caseId: CASE_ID,
      prompt: "Get Paris weather",
      model: model2,
      auditTrail,
      runStore,
      markerStore,
      preconditionTable: table,
    });

    // lookupAsset marker still there (from run 1)
    expect(await markerStore.has(CASE_ID, "called:lookupAsset")).toBe(true);

    // getWeather was blocked because called:triage is missing
    const run2Entries = await auditTrail.listByRun(runId2);
    const blocked = run2Entries.filter((e) => e.kind === "precondition_unmet");
    expect(blocked.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 5. Guidance generation ────────────────────────────────────────────────────

describe("PreconditionUnmetGuidance", () => {
  it("generates structured guidance with all required fields", () => {
    const rule: PreconditionRule = { allOf: ["called:triage", "evidence_complete"] };
    const entry = {
      rule,
      suggestedNext: ["triageTool", "evidenceGatherer"],
    };
    const guidance = generateGuidance("blockIp", entry, ["evidence_complete"]);

    expect(guidance.status).toBe("precondition_unmet");
    expect(guidance.interface).toBe("blockIp");
    expect(guidance.rule).toEqual(rule);
    expect(guidance.missing).toEqual(["evidence_complete"]);
    expect(guidance.suggestedNext).toEqual(["triageTool", "evidenceGatherer"]);
    expect(typeof guidance.message).toBe("string");
    expect(guidance.message.length).toBeGreaterThan(0);
  });

  it("isPreconditionUnmet guard returns false for non-matching objects", () => {
    expect(isPreconditionUnmet(null)).toBe(false);
    expect(isPreconditionUnmet(undefined)).toBe(false);
    expect(isPreconditionUnmet("string")).toBe(false);
    expect(isPreconditionUnmet(42)).toBe(false);
    expect(isPreconditionUnmet({})).toBe(false);
    expect(isPreconditionUnmet({ status: "ok" })).toBe(false);
    expect(isPreconditionUnmet({ status: "precondition_unmet" })).toBe(true);
  });
});
