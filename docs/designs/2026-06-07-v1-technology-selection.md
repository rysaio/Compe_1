# V1 Core Design & Technology Stack

> Status: ALIGNED
> Author: user
> Last updated: 2026-06-15
> Decisions recorded in:
> - `docs/adr/0001-v1-technology-direction.md` — the stack choice and its upgrade triggers
> - `docs/adr/0004-core-is-a-general-agent-loop.md` — core = general Agent Loop, external components pluggable
> - `docs/adr/0003-model-driven-investigation.md` — determinism lives on the boundaries, not the investigation path
> Research input: `docs/research/security-systems-and-agent-integration.md`

This spec owns the **design substance** for v1's core and technology stack: what
the core is, how the Agent Loop is built on the chosen stack, and how the
pluggable external components attach. The ADRs above record the *decisions* and
their status; this spec is where the "how it's built" lives. Lower-level,
phase-specific build instructions for the first coding step live in
`docs/designs/2026-06-15-bare-agent-loop.md`.

## Background

The project is a security operations harness, not a detection platform, fixed
workflow bot, one-shot chatbot, SIEM replacement, SOAR replacement, or EDR
replacement. The v1 must prove that an agent can keep working around operational
cases, case work items, agent jobs, evidence probes, tools, wake gates, policy
gates, and audit records before the project invests in heavier workflow or agent
frameworks.

## In scope

- The v1 technology stack and how the core is built on it.
- A future path to Temporal or Mastra if v1 evidence justifies them.

## Out of scope

- Production deployment architecture.
- Full SOAR workflow orchestration.
- Self-built detection, SIEM, EDR, SOAR, correlation, risk-scoring, fleet
  telemetry, or raw telemetry platform. If an upstream platform already owns a
  signal, case, automation, or response action, the harness integrates with that
  ownership rather than duplicating it.
- A Python-first worker runtime unless a future subsystem proves it is needed.

## Assumptions

- v1 is TypeScript-first.
- The product should be usable without requiring Wazuh, Splunk, or an EDR to be
  deployed first.
- Wazuh, Sysmon, SIEM, EDR, firewalls, log platforms, or SOAR tools remain
  upstream signal, case, automation, or response-action sources when present.
- A small built-in evidence probe kit provides investigation-time access to
  endpoint, host-log, network-flow, and artifact evidence.
- Postgres is the durable source of truth for cases, case work items, agent
  jobs, audit records, and structured operational memory.
- The first useful product should be a core-capable MVP that can later harden
  into a stronger runtime.

## Technology stack

The components that implement the core:

- **Next.js** — the first Harness Service API surface, plus an optional reference
  operator interface for case views, approval surfaces, and audit views. User
  interfaces and external systems consume the service API rather than own
  business state.
- **Vercel AI SDK + provider SDKs** — streaming model interaction, structured
  model calls, tool-calling behavior, and the first agent execution surface.
- **Postgres** — the single durable source of truth for operational cases, case
  work items, agent jobs, audit records, and structured operational memory.
- **pg-boss + a dedicated TypeScript worker loop** — the agent runtime: it leases
  agent jobs from the Postgres-native queue, runs bounded Agent Runs, and writes
  results back to case work items and the audit trail.
- **Evidence probe kit** — investigation-time evidence tools such as osquery,
  event-log readers, Zeek or NetFlow importers, and artifact readers.
- **Wake Gate / Policy Gate** — a minimal deterministic wake gate before agent
  runtime and human attention is consumed; a deterministic policy gate before any
  real action is executed.

## Core architecture: the general Agent Loop and its approval boundary

The product core is a general observe-plan-act-record Agent Loop, specialized for
security only by skills, prompts, and workflow guidance plus a two-path approval
boundary. The core runs even when every external component is detached (the bare
loop). The approval boundary is the security specialization and is non-negotiable:

- a deterministic **Policy Gate** before any real action (a human-approval path
  plus an automatic rule-based approval path);
- the **Evidence Protocol** as the output constraint on conclusions and action
  recommendations.

Postgres is the one durable business truth source — not hidden model memory or
workflow history.

## How the Agent Loop is built (SDK vs harness responsibilities)

This boundary is version-independent; it does not depend on which Vercel AI SDK
major is pinned.

- The within-Run ReAct multi-step loop — the model reasons, calls a typed
  Evidence Tool, reads the result, and continues — is provided by the Vercel AI
  SDK's multi-step tool calling, not hand-rolled against a raw provider API.
- The harness, not the SDK, owns the loop's control flow: per-Run step and budget
  caps, the Policy Gate check before any real action, the per-step Audit Trail
  write, and the Evidence Protocol sufficiency check. These are interposed through
  the SDK's per-step hooks and tool-level execute wrappers; the loop is not handed
  off to an autonomous black-box run. Determinism stays on the boundary, not the
  investigation path (ADR 0003) — the model still chooses which tool and when.
- A Run is bounded. Cross-Run continuity is the worker loop leasing the next agent
  job from pg-boss and starting a new bounded Run, never a long-running SDK
  session; CONTEXT.md forbids open-ended sessions and unbounded loops for both
  Agent Loop and Agent Run.
- A Run terminates at the action-approval boundary: when a recommended action
  needs human approval, the Run ends and records a Case Work Item in
  awaiting_approval; approval releases a new agent job that starts the next Run.
  This is what lets v1 defer long human-wait timers and crash-proof replay.

## Pluggable external components

Per ADR 0004 these decouple from the loop: detach them and the bare Agent Loop
still runs. They are specific to a given usage/deployment, attach through thin
seams, and adding a new one is a plugin change, not a core change.

- **Wake Gate** — a minimal deterministic trigger deciding whether a signal,
  schedule, or operator event should consume agent runtime and human attention: a
  persistent monitoring platform when attached, or a single human prompt when not.
  The bare loop's degenerate Wake Gate is a prompt entrypoint.
- **Evidence Tools / probe kit** — a typed, allowlisted evidence-gathering surface
  the agent may call during an investigation. v1 ships these as a probe-first,
  Wazuh-compatible posture, but the loop runs with them stubbed. Wazuh, Sysmon,
  SIEM, EDR, firewall, log-platform, and SOAR capabilities remain upstream
  systems; Wazuh is a compatible adapter target, not a hard prerequisite for v1.
- **Source adapter / Signal Intake** — the input adapter that normalizes, dedups,
  and burst-merges raw upstream alerts into a Normalized Signal before the Wake
  Gate. It sits outside the core behind a plugin interface.

## Edge cases & risks

| Category | Notes |
|---|---|
| Boundary conditions | The worker loop must not hide business truth in model memory; it must read and write Postgres case work items and audit trail. |
| Failure modes | A simple worker loop may be weaker than Temporal for crash recovery and long human waits. |
| Risks | The harness may drift into rebuilding SIEM/SOAR/EDR features or over-triggering agent runs. Deferring Mastra may require hand-writing small tool registry, eval, trace, or memory conventions. |
| Mitigation | Keep worker tasks leased, idempotent, auditable, wake-gated, and policy-gated; keep evidence probes investigation-scoped; keep upstream platform ownership explicit; keep agent concerns isolated so the Mastra/Temporal upgrade paths recorded in ADR 0001 stay open. |

## Acceptance criteria

- AC-1 The v1 dependency plan does not require Temporal, Celery, or Mastra.
- AC-2 The v1 app has one durable business truth source for cases, case work
  items, agent jobs, audit records, and structured operational memory: Postgres.
- AC-3 The v1 agent runtime is a dedicated TypeScript worker loop that executes
  agent jobs and writes results back to case work items and audit trail.
- AC-4 The v1 exposes a harness service API as the core product surface; any
  operator UI is a consumer of that API, not the source of truth.
- AC-5 Signals, schedules, or operator events cannot consume agent runtime
  without passing a minimal deterministic wake gate.
- AC-6 Model or agent output cannot execute a real action unless a deterministic
  policy gate approves it.
- AC-7 The v1 product can gather basic investigation evidence without requiring
  the user to deploy Wazuh, Splunk, or an EDR first.
- AC-8 The v1 boundary stays Wazuh-compatible while not rebuilding SIEM/SOAR/EDR
  detection, correlation, playbook, endpoint-protection, fleet-telemetry, or
  data-lake capabilities.
- AC-9 The architecture keeps explicit upgrade triggers for Temporal and Mastra
  (recorded in ADR 0001) rather than treating either as a default dependency.

## Core entities (ontology)

| Entity | Type | Key fields | Relationship |
|---|---|---|---|
| Security Operations Harness | Product concept | tools, case work items, policy, audit | Hosts the agent loop |
| Harness Service API | Service surface | cases, signals, evidence, work items, approvals, audit | Exposes the harness to UIs and external systems |
| Evidence Probe Kit | Tool surface | probe type, query, target, result, retention | Gathers investigation-time evidence |
| Agent Loop | Runtime behavior | observe, plan, act, record | Bounded run over case work items |
| Operational Case | Business object | status, severity, evidence, work items | Parent of evidence, work items, audit |
| Case Work Item | Business state | status, type, case_id, outcome, audit links | Business-level work inside a case |
| Agent Job | Runtime state | job type, case_id, work_item_id, lease, retry | Drives bounded agent runs |
| Evidence Protocol | Domain rule | case type, required evidence, gap rules, confidence | Constrains conclusions and action proposals |
| Signal Intake | Processing step | signal type, parser, normalization, dedup | Deterministic pre-wake-gate processing |
| Wake Gate | Runtime boundary | event type, priority, cooldown, budget, reason | Controls agent runtime and attention consumption |
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
