# ReAct Agent Run Stability Implementation Plan

> Status: APPROVED
> Source: user request + `docs/designs/2026-06-15-bare-agent-loop.md`
> Mode: --quick
> Iterations: 1 / 3
> Last updated: 2026-06-21

## Requirements Summary

Make the Agent Loop more directly runnable as a ReAct-style loop: one Agent Run
must support multiple model calls, typed tool execution, returned tool results,
approval pause/resume, and a stable caller-facing outcome. This slice does not
add Postgres, workers, new tools, or a Harness Service API layer.

## Acceptance Criteria

- AC-1 `runAgentLoop()` returns `runId`, `status`, final `finishReason`, and
  execution counters for model steps and tool executions on normal completion.
- AC-2 `runAgentLoop()` returns `pendingApproval` details when the run pauses for
  approval, while preserving persisted SDK messages for resume.
- AC-3 `resumeAgentLoop()` returns final `finishReason` and execution counters
  after an approved action resumes and completes.
- AC-4 Audit Trail behavior stays stable: each model step is recorded as
  `step_finished`; each executed tool result is recorded once as `tool_result`;
  precondition blocks are recorded as `precondition_unmet`.
- AC-5 The public core export still type-checks and existing tests continue to
  pass.

## Implementation Steps

1. Document this slice in `docs/designs/2026-06-21-react-agent-run-stability.md`.
2. Add a failing unit test in `core/tests/agent-loop.test.ts` for a two-step
   automatic run that expects `finishReason`, `steps`, and `toolExecutions`.
3. Add a failing unit test in `core/tests/agent-loop.test.ts` for approval
   pause/resume that expects `pendingApproval` on pause and resume counters on
   completion.
4. Update `core/src/agent-loop.ts` only:
   - Extend `RunResult` with optional `finishReason`, `steps`,
     `toolExecutions`, and `pendingApproval`.
   - Count steps inside `onStepFinish` and tool executions inside
     `experimental_onToolCallFinish`.
   - Return the same metadata on completed, awaiting approval, approved resume,
     and denied resume paths.
5. Run narrow test:
   `npm test -- agent-loop.test.ts`
6. Run full package checks:
   `npm test`
   `npm run typecheck`

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Counters drift from Audit Trail writes | Increment counters in the same callbacks that write audit records. |
| Approval pause looks like completion | Keep `status: "awaiting_approval"` and include `pendingApproval` only on that path. |
| Caller mistakes counters for durable state | Do not persist counters in `RunStore`; Audit Trail remains durable history. |
| Scope expands into worker/API design | Keep all code changes inside `core/src/agent-loop.ts` and tests. |

## Verification Steps

- AC-1/AC-3: `npm test -- agent-loop.test.ts`
- AC-4: existing audit tests in `core/tests/agent-loop.test.ts`
- AC-5: `npm test` and `npm run typecheck`

## ADR

- Decision: expose per-run execution metadata from the existing Agent Loop
  result object instead of introducing a new runtime state owner.
- Drivers: minimal code, caller observability, no new persistence surface.
- Alternatives considered:
  - Chosen: derive result metadata from callbacks already used for Audit Trail.
  - Rejected: persist counters in `RunStore`; this would make a transient
    reporting convenience look like durable source-of-truth state.
  - Rejected: add a new run-summary store; this duplicates Audit Trail before
    the Service API layer exists.
- Consequences: callers can distinguish completed, paused, and resumed runs
  without scanning audit entries; Audit Trail remains the durable record.

## Quick Mode Rationale

The slice touches one runtime owner and one test file, follows accepted ADRs
0003-0005, and has precise local verification commands. A full multi-iteration
plan would add process weight without reducing implementation uncertainty.
