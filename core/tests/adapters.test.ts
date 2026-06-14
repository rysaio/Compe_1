/**
 * Tests for in-memory port adapters: AuditTrail and RunStore.
 *
 * These tests are pure logic — no network, no SDK, no model.
 * They define the contract that any adapter (Postgres etc.) must satisfy.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAuditTrail } from "../src/in-memory-audit-trail.js";
import { InMemoryRunStore } from "../src/in-memory-run-store.js";

// ─── AuditTrail ───────────────────────────────────────────────────────────────

describe("InMemoryAuditTrail", () => {
  let trail: InMemoryAuditTrail;

  beforeEach(() => {
    trail = new InMemoryAuditTrail();
  });

  it("returns empty list for unknown run", async () => {
    const entries = await trail.listByRun("no-such-run");
    expect(entries).toEqual([]);
  });

  it("appends an entry and retrieves it by runId", async () => {
    const entry = await trail.append({
      runId: "run-1",
      kind: "run_started",
      data: { caseId: "case-1" },
    });

    expect(entry.id).toBeTruthy();
    expect(entry.runId).toBe("run-1");
    expect(entry.kind).toBe("run_started");
    expect(entry.timestamp).toBeInstanceOf(Date);

    const list = await trail.listByRun("run-1");
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(entry.id);
  });

  it("maintains insertion order for multiple entries", async () => {
    await trail.append({ runId: "run-2", kind: "run_started", data: {} });
    await trail.append({ runId: "run-2", kind: "step_finished", data: { step: 1 } });
    await trail.append({ runId: "run-2", kind: "run_finished", data: {} });

    const list = await trail.listByRun("run-2");
    expect(list.map((e) => e.kind)).toEqual([
      "run_started",
      "step_finished",
      "run_finished",
    ]);
  });

  it("isolates entries across different runs", async () => {
    await trail.append({ runId: "run-A", kind: "run_started", data: {} });
    await trail.append({ runId: "run-B", kind: "run_started", data: {} });

    expect(await trail.listByRun("run-A")).toHaveLength(1);
    expect(await trail.listByRun("run-B")).toHaveLength(1);
  });

  it("assigns unique ids to each entry", async () => {
    const a = await trail.append({ runId: "run-3", kind: "step_finished", data: {} });
    const b = await trail.append({ runId: "run-3", kind: "step_finished", data: {} });
    expect(a.id).not.toBe(b.id);
  });
});

// ─── RunStore ─────────────────────────────────────────────────────────────────

describe("InMemoryRunStore", () => {
  let store: InMemoryRunStore;

  beforeEach(() => {
    store = new InMemoryRunStore();
  });

  it("returns undefined for unknown run", async () => {
    expect(await store.get("no-such-run")).toBeUndefined();
  });

  it("creates a run and retrieves it", async () => {
    const run = await store.create({
      id: "run-1",
      caseId: "case-1",
      status: "pending",
      messages: [],
    });

    expect(run.id).toBe("run-1");
    expect(run.caseId).toBe("case-1");
    expect(run.status).toBe("pending");
    expect(run.createdAt).toBeInstanceOf(Date);
    expect(run.updatedAt).toBeInstanceOf(Date);

    const fetched = await store.get("run-1");
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe("run-1");
  });

  it("updates run status", async () => {
    await store.create({ id: "run-2", caseId: "case-2", status: "pending", messages: [] });
    const updated = await store.update("run-2", { status: "running" });

    expect(updated.status).toBe("running");

    const fetched = await store.get("run-2");
    expect(fetched!.status).toBe("running");
  });

  it("updates messages for human-approval resume", async () => {
    await store.create({ id: "run-3", caseId: "case-3", status: "pending", messages: [] });
    const msgs = [{ role: "user", content: "test" }];
    await store.update("run-3", { messages: msgs });

    const fetched = await store.get("run-3");
    expect(fetched!.messages).toEqual(msgs);
  });

  it("throws when updating unknown run", async () => {
    await expect(store.update("ghost", { status: "failed" })).rejects.toThrow(
      "AgentRun not found: ghost"
    );
  });

  it("updatedAt advances after update", async () => {
    await store.create({ id: "run-4", caseId: "c", status: "pending", messages: [] });
    const before = (await store.get("run-4"))!.updatedAt;
    // small pause to ensure clock advances
    await new Promise((r) => setTimeout(r, 5));
    await store.update("run-4", { status: "running" });
    const after = (await store.get("run-4"))!.updatedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});
