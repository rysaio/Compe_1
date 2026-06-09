# ADR 0001: V1 Technology Direction

Status: Accepted
Date: 2026-06-07

## Context

This project builds a security operations harness rather than a one-shot SOC
chatbot, fixed workflow bot, or detection platform. The first useful product
must prove a persistent agent loop around operational cases, task state, tools,
policy checks, and audit records before investing in heavier workflow or
platform infrastructure.

The v1 needs to run as a small local demo that can use real endpoint and
security-platform signals, while keeping detection and raw telemetry collection
as upstream responsibilities of systems such as Wazuh, Sysmon, EDR, SIEM,
firewalls, or log platforms.

## Decision

Use a TypeScript-first stack for v1:

- Next.js for the web console, operator cockpit, case views, approval surfaces,
  and API routes.
- Vercel AI SDK and provider SDKs for streaming model interaction, structured
  model calls, tool-calling UI behavior, and the first agent execution surface.
- A dedicated TypeScript background worker loop for the security operations
  agent runtime.
- Postgres as the source of truth for operational cases, task ledger, action
  ledger, audit records, and structured operational memory.
- Deterministic policy gates before any real action is executed.
- Wazuh/Sysmon or similar tools as upstream signal sources, not as code owned by
  this product.

Do not make Temporal, Celery, or Mastra mandatory v1 dependencies.

For the "Next.js/Vercel vs Mastra" choice, v1 chooses Next.js plus Vercel AI SDK
and provider SDKs as the first agentic web surface. Mastra remains an optional
later layer if the project starts rebuilding tool registry, evals, tracing, or
agent-memory features by hand.

For the "Temporal vs Celery" choice, v1 chooses neither as a mandatory runtime.
Use a Postgres-backed task ledger plus a TypeScript worker loop. Keep the
runtime boundaries narrow enough that Temporal can later replace or strengthen
the worker loop if long-running durability, crash recovery, and compensation
become the next bottleneck. Celery is not a default fit for the TypeScript-first
v1 unless a future Python subsystem becomes the canonical worker runtime.

## Consequences

- v1 stays focused on proving the security operations harness and agent loop
  instead of proving a workflow platform.
- The system has one durable business truth source: Postgres, not hidden model
  memory or workflow history.
- The first worker loop must be intentionally shaped around task leasing,
  retries, idempotent tools, policy checks, and audit writes so the later
  Temporal upgrade path remains feasible.
- Some durability features are explicitly deferred: crash-proof workflow replay,
  long human waits with built-in timers, and first-class compensation workflows.
- If v1 proves strong automation needs reliable long-running recovery, Temporal
  becomes the preferred upgrade path rather than adding ad hoc retry branches.
- If v1 proves the agent layer needs framework-owned tool registry, evals,
  tracing, or memory primitives, Mastra becomes the preferred agent-layer
  upgrade path rather than spreading those concerns across UI routes and worker
  code.
