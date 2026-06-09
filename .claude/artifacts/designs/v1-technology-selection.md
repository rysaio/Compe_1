# V1 Technology Selection Spec

> Status: ALIGNED
> Author: user
> Last updated: 2026-06-07

## Background

The project is a security operations harness, not a detection platform, fixed
workflow bot, or one-shot chatbot. The v1 must prove that an agent can keep
working around operational cases, a task ledger, tools, policy gates, and audit
records before the project invests in heavier workflow or agent frameworks.

## In scope

- Decide the v1 choice between Next.js/Vercel AI SDK and Mastra.
- Decide the v1 choice between Temporal and Celery-style task execution.
- Preserve a future path to Temporal or Mastra if v1 evidence justifies them.

## Out of scope

- Production deployment architecture.
- Full SOAR workflow orchestration.
- Self-built detection, SIEM, EDR, or raw telemetry platform.
- A Python-first worker runtime unless a future subsystem proves it is needed.

## Assumptions

- v1 is TypeScript-first.
- Wazuh, Sysmon, SIEM, EDR, firewalls, or log platforms provide upstream signals.
- Postgres is the durable source of truth for cases, tasks, actions, audit, and
  structured operational memory.
- The first useful product should be a small local demo that can later harden
  into a stronger runtime.

## Solution

Choose **Next.js + Vercel AI SDK/provider SDKs + Postgres + a dedicated
TypeScript worker loop** for v1.

Do not include Mastra, Temporal, or Celery as mandatory v1 dependencies.

Use Next.js for the operator cockpit, case views, approval surfaces, and API
routes. Use Vercel AI SDK/provider SDKs for streaming model interaction,
structured model calls, tool-calling UI behavior, and the first agent execution
surface. Use a dedicated TypeScript worker loop to run the security operations
agent over the Postgres task ledger. Use deterministic policy gates before any
real action is executed.

Mastra remains the preferred later upgrade if the project starts rebuilding
agent-layer primitives such as framework-owned tool registry, evals, tracing, or
memory. Temporal remains the preferred later upgrade if the worker loop becomes
blocked by long-running durability, crash recovery, compensation workflows, or
human waits. Celery is not selected for v1 because it implies a Python worker
runtime that does not match the TypeScript-first direction.

## Edge cases & risks

| Category | Notes |
|---|---|
| Boundary conditions | The worker loop must not hide business truth in model memory; it must read and write the Postgres task ledger. |
| Failure modes | A simple worker loop may be weaker than Temporal for crash recovery and long human waits. |
| Risks | Deferring Mastra may require hand-writing small tool registry, eval, trace, or memory conventions. |
| Mitigation | Keep worker tasks leased, idempotent, auditable, and policy-gated; keep agent concerns isolated so Mastra or Temporal can be added later. |

## Acceptance criteria

- AC-1 The v1 dependency plan does not require Temporal, Celery, or Mastra.
- AC-2 The v1 app has one durable business truth source for cases, tasks,
  actions, audit records, and structured operational memory: Postgres.
- AC-3 The v1 agent runtime is a dedicated TypeScript worker loop that consumes
  task-ledger work and writes auditable progress.
- AC-4 Model or agent output cannot execute a real action unless a deterministic
  policy gate approves it.
- AC-5 The architecture keeps explicit upgrade triggers for Temporal and Mastra
  rather than treating either as a default dependency.

## Core entities (ontology)

| Entity | Type | Key fields | Relationship |
|---|---|---|---|
| Security Operations Harness | Product concept | tools, task state, policy, audit | Hosts the agent loop |
| Agent Loop | Runtime behavior | observe, plan, act, record | Runs over the task ledger |
| Operational Case | Business object | status, severity, evidence, actions | Contains tasks and audit |
| Task Ledger | Durable state | task status, lease, result, audit links | Drives worker execution |
| Policy Gate | Safety boundary | action type, target, approval, deny reason | Controls real actions |

## Interview metadata

- Mode: default
- Waves: 1
- Final ambiguity: 18%
- Status: PASSED

### Clarity breakdown

| Dimension | Score | Weight | Weighted |
|---|---:|---:|---:|
| Goal | 0.90 | 0.43 | 0.387 |
| Scope | 0.90 | 0.28 | 0.252 |
| AC | 0.85 | 0.29 | 0.247 |
