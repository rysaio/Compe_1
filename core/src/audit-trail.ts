/**
 * Audit Trail port — append-only log of every step in an Agent Run.
 *
 * Per CONTEXT.md: "The durable record of signals observed, evidence gathered,
 * recommendations made, policy decisions, human approvals, actions executed,
 * and outcomes."
 *
 * In-memory adapter ships here; Postgres adapter slots in later without
 * touching core logic.
 */

export type AuditEntryKind =
  | "run_started"
  | "step_finished"
  | "tool_called"
  | "tool_result"
  | "awaiting_approval"
  | "approval_granted"
  | "approval_denied"
  | "run_finished";

export interface AuditEntry {
  readonly id: string;
  readonly runId: string;
  readonly kind: AuditEntryKind;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

/** Port: append a new entry to the Audit Trail. */
export interface AuditTrail {
  append(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<AuditEntry>;
  listByRun(runId: string): Promise<AuditEntry[]>;
}
