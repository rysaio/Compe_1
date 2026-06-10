# ADR 0001: V1 Technology Direction

Status: Accepted
Date: 2026-06-07

Source material:

- `docs/designs/2026-06-07-v1-technology-selection.md`
- `docs/research/security-systems-and-agent-integration.md`

## Context

This project builds a security operations harness rather than a one-shot SOC
chatbot, fixed workflow bot, or detection platform. The first useful product
must prove a bounded agent loop around operational cases, case work items,
agent jobs, policy checks, and audit records before investing in heavier
workflow or platform infrastructure.

The v1 needs to be a core-capable MVP that can gather real investigation
evidence without requiring the user to already run a SIEM/SOAR, while keeping
detection, fleet telemetry collection, correlation, and SOAR-style playbook
automation outside the product's ownership. Existing systems such as Wazuh,
Sysmon, EDR, SIEM, firewalls, log platforms, or SOAR tools remain upstream
systems when present.

## Decision

Use a TypeScript-first stack for v1:

- Next.js for the first harness service API surface and an optional reference
  operator interface for case views, approval surfaces, and audit views.
- Vercel AI SDK and provider SDKs for streaming model interaction, structured
  model calls, tool-calling UI behavior, and the first agent execution surface.
- A dedicated TypeScript background worker loop for the security operations
  agent runtime.
- Postgres as the source of truth for operational cases, case work items,
  agent jobs, audit records, and structured operational memory.
- A minimal deterministic wake gate to decide whether signals, schedules, or
  operator events should consume agent runtime and human attention.
- Deterministic policy gates before any real action is executed.
- A probe-first, Wazuh-compatible integration posture:
  - The harness includes a small evidence probe kit for investigation, such as
    osquery, event-log readers, Zeek or NetFlow importers, and artifact readers.
  - Wazuh, Sysmon, SIEM, EDR, firewall, log-platform, and SOAR capabilities
    remain upstream systems, not code owned by this product.
  - Wazuh is a compatible adapter target, not a hard prerequisite for v1 use.

Do not rebuild SIEM/SOAR capabilities in v1. Detection engineering,
correlation engines, risk scoring, playbook designers, fleet telemetry
platforms, full security data lakes, and mature case-management replacement are
explicitly outside the product's core ownership. If an upstream platform already
owns a signal, case, automation, or response action, the harness should
integrate with that ownership rather than duplicating it.

Do not make Temporal, Celery, or Mastra mandatory v1 dependencies.

For the "Next.js/Vercel vs Mastra" choice, v1 chooses Next.js plus Vercel AI SDK
and provider SDKs as the first API-first agentic service surface, with any
operator UI treated as a consumer of that service. Mastra remains an optional
later layer if the project starts rebuilding tool registry, evals, tracing, or
agent-memory features by hand.

For the "Temporal vs Celery" choice, v1 chooses neither as a mandatory runtime.
Use Postgres-backed case work items and a Postgres-native job queue (pg-boss)
for agent jobs, plus a TypeScript worker loop. Keep the runtime boundaries
narrow enough that Temporal can later replace or strengthen the worker loop if
long-running durability, crash recovery, and compensation become the next
bottleneck. Celery is not a default fit for the TypeScript-first
v1 unless a future Python subsystem becomes the canonical worker runtime.

## Consequences

- v1 stays focused on proving the security operations harness and agent loop
  instead of proving a workflow, SIEM, or SOAR platform.
- The system has one durable business truth source: Postgres, not hidden model
  memory or workflow history.
- The first integration path optimizes for product independence: the harness can
  gather basic evidence itself, while improving when Wazuh-like or EDR/SIEM
  environments already exist.
- The evidence probe kit must remain an investigation-time probe surface, not a
  continuous fleet telemetry or detection platform.
- Wake gating must remain about agent runtime cost and attention pressure, not
  about replacing upstream detection, risk scoring, or correlation.
- The first worker loop must be intentionally shaped around agent job leasing,
  retries, idempotent tools, policy checks, and audit writes so the later
  Temporal upgrade path remains feasible.
- Some durability features are explicitly deferred: crash-proof workflow replay,
  long human waits with built-in timers, and first-class compensation workflows.
- If v1 proves strong automation needs reliable long-running recovery, Temporal
  becomes the preferred upgrade path rather than adding ad hoc retry branches.
- If v1 proves the agent layer needs framework-owned tool registry, evals,
  tracing, or memory primitives, Mastra becomes the preferred agent-layer
  upgrade path rather than spreading those concerns across service routes and
  worker code.
