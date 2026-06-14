/**
 * @harness/core — Bare Agent Loop
 *
 * Public surface:
 *   - Ports (interfaces): AuditTrail, RunStore
 *   - Adapters: InMemoryAuditTrail, InMemoryRunStore
 *   - Agent Loop: runAgentLoop, resumeAgentLoop
 *   - Tool stubs: allTools, evidenceTools, actionTools
 *   - Types: RunAgentLoopOptions, RunResult, ResumeAgentLoopOptions, ApprovalDecision
 */

// ─── Ports ────────────────────────────────────────────────────────────────────
export type {
  AuditEntry,
  AuditEntryKind,
  AuditTrail,
} from "./audit-trail.js";

export type { AgentRun, RunStatus, RunStore } from "./run-store.js";

// ─── In-memory adapters ───────────────────────────────────────────────────────
export { InMemoryAuditTrail } from "./in-memory-audit-trail.js";
export { InMemoryRunStore } from "./in-memory-run-store.js";

// ─── Agent Loop ───────────────────────────────────────────────────────────────
export {
  runAgentLoop,
  resumeAgentLoop,
} from "./agent-loop.js";

export type {
  LanguageModel,
  RunAgentLoopOptions,
  RunResult,
  ApprovalDecision,
  ResumeAgentLoopOptions,
} from "./agent-loop.js";

// ─── Tools ───────────────────────────────────────────────────────────────────
export {
  allTools,
  evidenceTools,
  actionTools,
  lookupAssetTool,
  lookupIpTool,
  blockIpTool,
} from "./tools.js";
