/**
 * RunStore port — mutable state for an Agent Run.
 *
 * Per CONTEXT.md: "Agent Run — A single bounded execution of the Agent Loop
 * over an Operational Case or Case Work Item, started by an Agent Job and
 * ending with a recorded outcome."
 *
 * In-memory adapter ships here; Postgres adapter slots in later.
 */

export type RunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed";

export interface AgentRun {
  readonly id: string;
  readonly caseId: string;
  status: RunStatus;
  /**
   * SDK messages accumulated during this run.
   * Persisted so the human-approval path can resume from the exact
   * conversation state (see spec: generateText called twice).
   */
  messages: unknown[];
  readonly createdAt: Date;
  updatedAt: Date;
}

/** Port: read and write Agent Run state. */
export interface RunStore {
  create(run: Omit<AgentRun, "createdAt" | "updatedAt">): Promise<AgentRun>;
  get(id: string): Promise<AgentRun | undefined>;
  update(
    id: string,
    patch: Partial<Pick<AgentRun, "status" | "messages">>
  ): Promise<AgentRun>;
}
