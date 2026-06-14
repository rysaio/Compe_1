# ADR 0001: V1 Technology Direction

Status: Accepted
Date: 2026-06-07
Amended: 2026-06-14 — restructured to match ADR 0004 (core = general Agent Loop;
Wake Gate and Evidence Tools are pluggable external components, not core).
Amended: 2026-06-15 — the full stack design moved to the design spec; this ADR
now records only the decision and its triggers.

Source / design: `docs/designs/2026-06-07-v1-technology-selection.md`
Research input: `docs/research/security-systems-and-agent-integration.md`

## Context

v1 must be a core-capable MVP that proves a bounded agent loop around operational
cases, case work items, agent jobs, policy checks, and audit records before
investing in heavier workflow or platform infrastructure. Two technology forks
had to be settled to start:

- the agentic service surface: Next.js + Vercel AI SDK/provider SDKs vs Mastra;
- the runtime: Temporal vs Celery vs neither.

## Decision

Use a **TypeScript-first** stack, structured per ADR 0004 into the core (the
general Agent Loop and its non-negotiable approval boundary) and the pluggable
external components that attach to it.

- For the service surface, choose **Next.js + Vercel AI SDK and provider SDKs** as
  the first API-first agentic surface, with any operator UI treated as a consumer.
  Mastra is **not** a mandatory v1 dependency.
- For the runtime, choose **neither Temporal nor Celery as mandatory**: use
  Postgres-backed case work items, a Postgres-native job queue (pg-boss), and a
  TypeScript worker loop. Keep the runtime boundaries narrow enough that Temporal
  can later replace or strengthen the worker loop.

The stack components, the core/external split, and how the Agent Loop is built on
this stack (SDK vs harness responsibilities) are specified in the design spec.

## Consequences

- v1 stays focused on proving the security operations harness and agent loop
  instead of proving a workflow, SIEM, or SOAR platform.
- The first build target is the bare Agent Loop (per ADR 0004): Wake Gate as a
  prompt entrypoint, Evidence Tools as stubs, Policy Gate and Evidence Protocol as
  minimal skeletons, running observe-plan-act-record end-to-end before any
  external component is fleshed out.
- The core stays agnostic to which external components are attached: swapping or
  adding one is a plugin change, not a core change.
- Some durability features are explicitly deferred: crash-proof workflow replay,
  long human waits with built-in timers, and first-class compensation workflows.
- The first worker loop must be shaped around agent job leasing, retries,
  idempotent tools, policy checks, and audit writes so the Temporal upgrade path
  stays feasible.

### Upgrade triggers

- **Temporal** becomes the preferred runtime upgrade if v1 proves a need for
  long-running durability, crash recovery, compensation workflows, or human waits
  — rather than adding ad hoc retry branches.
- **Mastra** becomes the preferred agent-layer upgrade if v1 proves the agent
  layer needs a framework-owned tool registry, evals, tracing, or memory
  primitives — rather than spreading those concerns across routes and worker code.
- **Celery** is not selected for v1: it implies a Python worker runtime that does
  not match the TypeScript-first direction, unless a future Python subsystem
  becomes the canonical worker runtime.
