# ADR 0001: V1 Technology Direction

Status: Accepted
Date: 2026-06-07
Amended: 2026-06-14 — stack restructured to match ADR 0004: the product core is
a general observe-plan-act-record Agent Loop plus its approval boundary, and
Wake Gate and Evidence Tools are reclassified as pluggable external components,
not core. See ADR 0004 for the reframing.

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

Use a TypeScript-first stack for v1, structured per ADR 0004 into the core
(the general Agent Loop and its non-negotiable approval boundary) and the
pluggable external components that attach to it.

### Core: the general Agent Loop and its truth source

The heart of the product is a general observe-plan-act-record Agent Loop,
specialized for security only by skills, prompts, and workflow guidance. The
following are core and run even when every external component is detached:

- A dedicated TypeScript background worker loop that runs the Agent Loop as the
  security operations agent runtime.
- Postgres as the source of truth for operational cases, case work items,
  agent jobs, audit records, and structured operational memory.
- Vercel AI SDK and provider SDKs for streaming model interaction, structured
  model calls, tool-calling behavior, and the first agent execution surface.
- Next.js for the first Harness Service API surface and an optional reference
  operator interface for case views, approval surfaces, and audit views.

### Core: how the Agent Loop is built (SDK vs harness responsibilities)

This boundary is version-independent; it does not depend on which Vercel AI SDK
major is pinned.

- The within-Run ReAct multi-step loop — the model reasons, calls a typed
  Evidence Tool, reads the result, and continues — is provided by the Vercel AI
  SDK's multi-step tool calling, not hand-rolled against a raw provider API.
- The harness, not the SDK, owns the loop's control flow: per-Run step and
  budget caps, the Policy Gate check before any real action, the per-step Audit
  Trail write, and the Evidence Protocol sufficiency check. These are interposed
  through the SDK's per-step hooks and tool-level execute wrappers; the loop is
  not handed off to an autonomous black-box run. Determinism stays on the
  boundary, not the investigation path (ADR 0003) — the model still chooses
  which tool and when.
- A Run is bounded (ADR 0003, ADR 0004). Cross-Run continuity is the worker loop
  leasing the next agent job from pg-boss and starting a new bounded Run, never
  a long-running SDK session; CONTEXT.md forbids open-ended sessions and
  unbounded loops for both Agent Loop and Agent Run.
- A Run terminates at the action-approval boundary: when a recommended action
  needs human approval, the Run ends and records a Case Work Item in
  awaiting_approval; approval releases a new agent job that starts the next Run.
  This is what lets v1 defer long human-wait timers and crash-proof replay.

### Core: the approval boundary (non-negotiable)

The agent's two-path approval boundary is part of the core, not a pluggable
component. It is what specializes the general loop for security alongside skills
and prompts:

- Deterministic Policy Gate before any real action is executed (human-approval
  path plus automatic rule-based approval).
- Evidence Protocol as the output constraint on conclusions and action
  recommendations.

### Pluggable external components (not core)

Per ADR 0004, these decouple from the loop; detach them and the bare Agent Loop
still runs. They are specific to a given usage/deployment, attached through thin
seams, and adding a new one is a plugin change, not a core change:

- **Wake Gate** — a minimal deterministic trigger deciding whether a signal,
  schedule, or operator event should consume agent runtime and human attention.
  It is "what triggered one Agent Run": a persistent monitoring platform when
  attached, or a single human prompt when not. The bare loop's degenerate Wake
  Gate is a prompt entrypoint.
- **Evidence Tools / probe kit** — a typed, allowlisted evidence-gathering
  surface the agent may call during an investigation (e.g. osquery, event-log
  readers, Zeek or NetFlow importers, artifact readers). v1 ships these as a
  probe-first, Wazuh-compatible posture, but the loop runs with them stubbed:
  - Wazuh, Sysmon, SIEM, EDR, firewall, log-platform, and SOAR capabilities
    remain upstream systems, not code owned by this product.
  - Wazuh is a compatible adapter target, not a hard prerequisite for v1 use.
- **Source adapter / Signal Intake** — the input adapter that normalizes,
  dedups, and burst-merges raw upstream alerts into a Normalized Signal before
  the Wake Gate. It sits outside the core behind a plugin interface.

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
- Per ADR 0004, the first build target is the bare Agent Loop — Wake Gate as a
  prompt entrypoint, Evidence Tools as stubs, Policy Gate and Evidence Protocol
  as minimal skeletons — running observe-plan-act-record end-to-end before any
  external component is fleshed out.
- The bare loop's approval is the SDK's native tool-approval flag in two modes:
  human (the tool requires approval before it runs) or automatic (the tool runs
  unattended). Server-side approval signing and the full Policy Gate are a later
  build step, not the bare loop.
- The system has one durable business truth source: Postgres, not hidden model
  memory or workflow history.
- The core stays agnostic to which external components (Wake Gate, Evidence
  Tools / probe kit, source adapter) are attached: swapping or adding one is a
  plugin change, not a core change.
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
