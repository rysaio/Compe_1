# V1 Technology Selection Spec

> Status: ALIGNED
> Author: user
> Last updated: 2026-06-07

## Background

The project is a security operations harness, not a detection platform, fixed
workflow bot, one-shot chatbot, SIEM replacement, SOAR replacement, or EDR
replacement. The v1 must prove that an agent can keep working around
operational cases, case work items, agent jobs, evidence probes, tools, wake
gates, policy gates, and audit records before the project invests in heavier
workflow or agent frameworks.

## In scope

- Decide the v1 choice between Next.js/Vercel AI SDK and Mastra.
- Decide the v1 choice between Temporal and Celery-style task execution.
- Preserve a future path to Temporal or Mastra if v1 evidence justifies them.

## Out of scope

- Production deployment architecture.
- Full SOAR workflow orchestration.
- Self-built detection, SIEM, EDR, SOAR, correlation, risk-scoring, fleet
  telemetry, or raw telemetry platform.
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

## Solution

Choose **Next.js + Vercel AI SDK/provider SDKs + Postgres + a dedicated
TypeScript worker loop** for v1.

Do not include Mastra, Temporal, or Celery as mandatory v1 dependencies.

Use Next.js for the operator cockpit, case views, approval surfaces, and API
routes. Use Vercel AI SDK/provider SDKs for streaming model interaction,
structured model calls, tool-calling UI behavior, and the first agent execution
surface. Use a dedicated TypeScript worker loop to run the security operations
agent by executing agent jobs from a Postgres-native job queue (pg-boss) and
writing results back to case work items and audit trail. Include a small
evidence probe kit for
investigation-time evidence gathering, such as osquery, event-log readers, Zeek
or NetFlow importers, and artifact readers. Use a minimal deterministic wake
gate before consuming agent runtime and human attention. Use deterministic
policy gates before any real action is executed.

Do not rebuild SIEM/SOAR/EDR capabilities in v1. Detection engineering,
correlation engines, risk scoring, playbook designers, mature security case
management replacement, continuous fleet telemetry, endpoint protection, and
full security data lakes remain outside the product boundary. If an upstream
platform already owns a signal, case, automation, or response action, the
harness should integrate with that ownership rather than duplicating it.

Mastra remains the preferred later upgrade if the project starts rebuilding
agent-layer primitives such as framework-owned tool registry, evals, tracing, or
memory. Temporal remains the preferred later upgrade if the worker loop becomes
blocked by long-running durability, crash recovery, compensation workflows, or
human waits. Celery is not selected for v1 because it implies a Python worker
runtime that does not match the TypeScript-first direction.

## Edge cases & risks

| Category | Notes |
|---|---|
| Boundary conditions | The worker loop must not hide business truth in model memory; it must read and write Postgres case work items and audit trail. |
| Failure modes | A simple worker loop may be weaker than Temporal for crash recovery and long human waits. |
| Risks | The harness may drift into rebuilding SIEM/SOAR/EDR features or over-triggering agent runs. Deferring Mastra may require hand-writing small tool registry, eval, trace, or memory conventions. |
| Mitigation | Keep worker tasks leased, idempotent, auditable, wake-gated, and policy-gated; keep evidence probes investigation-scoped; keep upstream platform ownership explicit; keep agent concerns isolated so Mastra or Temporal can be added later. |

## Acceptance criteria

- AC-1 The v1 dependency plan does not require Temporal, Celery, or Mastra.
- AC-2 The v1 app has one durable business truth source for cases, case work
  items, agent jobs, audit records, and structured operational memory: Postgres.
- AC-3 The v1 agent runtime is a dedicated TypeScript worker loop that executes
  agent jobs and writes results back to case work items and audit trail.
- AC-4 Signals, schedules, or operator events cannot consume agent runtime
  without passing a minimal deterministic wake gate.
- AC-5 Model or agent output cannot execute a real action unless a deterministic
  policy gate approves it.
- AC-6 The v1 product can gather basic investigation evidence without requiring
  the user to deploy Wazuh, Splunk, or an EDR first.
- AC-7 The v1 boundary stays Wazuh-compatible while not rebuilding SIEM/SOAR/EDR
  detection, correlation, playbook, endpoint-protection, fleet-telemetry, or
  data-lake capabilities.
- AC-8 The architecture keeps explicit upgrade triggers for Temporal and Mastra
  rather than treating either as a default dependency.

## Core entities (ontology)

| Entity | Type | Key fields | Relationship |
|---|---|---|---|
| Security Operations Harness | Product concept | tools, case work items, policy, audit | Hosts the agent loop |
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
