/**
 * In-memory adapter for RunStore port.
 *
 * Holds AgentRun state in a Map keyed by run id. Production code will
 * swap this for a Postgres adapter without touching the core Agent Loop.
 */
import { randomUUID } from "node:crypto";
import type { AgentRun, RunStore } from "./run-store.js";

export class InMemoryRunStore implements RunStore {
  private readonly store = new Map<string, AgentRun>();

  async create(run: Omit<AgentRun, "createdAt" | "updatedAt">): Promise<AgentRun> {
    const now = new Date();
    const full: AgentRun = { ...run, createdAt: now, updatedAt: now };
    this.store.set(full.id, full);
    return { ...full };
  }

  async get(id: string): Promise<AgentRun | undefined> {
    const r = this.store.get(id);
    return r ? { ...r } : undefined;
  }

  async update(
    id: string,
    patch: Partial<Pick<AgentRun, "status" | "messages">>
  ): Promise<AgentRun> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`AgentRun not found: ${id}`);
    const updated: AgentRun = { ...existing, ...patch, updatedAt: new Date() };
    this.store.set(id, updated);
    return { ...updated };
  }

  /** Test helper: generate a new run id */
  static newId(): string {
    return randomUUID();
  }
}
