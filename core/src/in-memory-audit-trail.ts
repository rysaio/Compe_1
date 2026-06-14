/**
 * In-memory adapter for AuditTrail port.
 *
 * All entries live in a Map keyed by runId. Production code will swap
 * this for a Postgres adapter without touching the core Agent Loop.
 */
import { randomUUID } from "node:crypto";
import type { AuditEntry, AuditTrail } from "./audit-trail.js";

export class InMemoryAuditTrail implements AuditTrail {
  /** Internal store: runId → ordered entries */
  private readonly store = new Map<string, AuditEntry[]>();

  async append(
    entry: Omit<AuditEntry, "id" | "timestamp">
  ): Promise<AuditEntry> {
    const full: AuditEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date(),
    };
    const list = this.store.get(entry.runId) ?? [];
    list.push(full);
    this.store.set(entry.runId, list);
    return full;
  }

  async listByRun(runId: string): Promise<AuditEntry[]> {
    return [...(this.store.get(runId) ?? [])];
  }
}
