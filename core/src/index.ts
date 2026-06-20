/**
 * @harness/core — Bare Agent Loop
 *
 * Public surface:
 *   - Ports (interfaces): AuditTrail, RunStore, PreconditionMarkerStore
 *   - Adapters: InMemoryAuditTrail, InMemoryRunStore, InMemoryPreconditionMarkerStore
 *   - Agent Loop: runAgentLoop, resumeAgentLoop
 *   - Tools: allTools (flat peer set) + individual tool exports
 *   - Precondition Gating: evaluate, generateGuidance, wrapAllTools, DEFAULT_PRECONDITION_TABLE
 *   - Types: RunAgentLoopOptions, RunResult, ResumeAgentLoopOptions, ApprovalDecision
 */

// ─── Ports ────────────────────────────────────────────────────────────────────
export type {
  AuditEntry,
  AuditEntryKind,
  AuditTrail,
} from "./audit-trail.js";

export type { AgentRun, RunStatus, RunStore } from "./run-store.js";

export type { PreconditionMarkerStore } from "./precondition-marker-store.js";

export type {
  Marker,
  PreconditionRule,
  PreconditionTable,
  PreconditionTableEntry,
  EvaluationResult,
  EvaluationOk,
  EvaluationBlocked,
  PreconditionUnmetGuidance,
} from "./precondition.js";

// ─── In-memory adapters ───────────────────────────────────────────────────────
export { InMemoryAuditTrail } from "./in-memory-audit-trail.js";
export { InMemoryRunStore } from "./in-memory-run-store.js";
export { InMemoryPreconditionMarkerStore } from "./precondition-marker-store.js";

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
  // classic generic tools
  calculatorTool,
  getWeatherTool,
  sendEmailTool,
  // security-operations stubs
  lookupAssetTool,
  lookupIpTool,
  blockIpTool,
  // precondition gating (ADR 0005)
  wrapAllTools,
  DEFAULT_PRECONDITION_TABLE,
} from "./tools.js";

// ─── Precondition Gating ──────────────────────────────────────────────────────
export {
  evaluate,
  generateGuidance,
  isPreconditionUnmet,
} from "./precondition.js";
