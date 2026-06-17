# Agent runs drive their own investigation; determinism lives in gates, tools, and protocol

Status: Accepted
Date: 2026-06-13

Inside an Agent Run, the model decides what evidence to gather, in what order,
and when it has enough — a bounded, case-agnostic, open-ended investigation
search, not a code-fixed step sequence. The harness's determinism does not sit
on the investigation path; it sits on the boundaries: Signal Intake, Wake Gate,
the typed Evidence Tools allowlist (the model emits no raw shell/SQL/VQL — only
bounded template calls), Evidence Protocol as an output constraint, Policy Gate,
and Audit Trail. The agent core is therefore agnostic to case type: a Wazuh
signal, a Windows PowerShell case, or the v1 Linux shell evidence table are
replaceable inputs and per-case-type configuration, not orchestration baked into
the core. Swap the input or the evidence table and the engine does not change.

## Why now

Q4 — "inside an Agent Run, who decides the order of investigation steps?" —
forced the choice. A deterministic skeleton walking a hardcoded evidence DAG was
considered and rejected: it welds one case type into the core and contradicts
ADR 0002's consequence that "a second asset dimension means a new evidence
table, not an architecture change." Three independent sources converged on the
model-driven shape: the Q4 reasoning itself, the blackboard evaluation in
`docs/research/inbox.md` ("v1 single worker loop, just don't hardcode the
planner"; a bounded fact-intent investigation search instead of a fixed
playbook, two-way and convergent, inside the three gates), and the research
report's typed-tool governance constraint.

## Considered Options

- **Model-driven, case-agnostic, bounded investigation (chosen).** The model
  runs the observe-plan-act-record loop over a typed Evidence Tools allowlist,
  choosing which tool to call, how often, and when evidence is sufficient.
  Determinism is enforced at the gates, the tool allowlist, and Evidence
  Protocol — not the path. It generalises to new case types by swapping inputs
  and configuration, which is what the "embeddable agent engine, not a SOC
  platform" north star requires.
- **Deterministic skeleton; model only at insertion points B (evidence
  synthesis) and C (action recommendation) (rejected).** Highly controllable,
  auditable, and small-model-friendly, but it hardcodes one case type's evidence
  structure into the core, making a second case type an architecture change — a
  direct contradiction of ADR 0002. Rejected on that ground.
- **Compromise: skeleton plus a bounded "model may request one more probe" hook
  (rejected for v1).** Narrower than full planning, but it still anchors the
  core to a per-case skeleton; once the investigation is model-driven anyway,
  the skeleton buys nothing. Folded into the chosen option.

## Consequences

- Determinism relocates from "investigation path" to the gates plus the typed
  tool allowlist plus the Evidence Protocol output constraint. Signal Intake,
  Wake Gate, Policy Gate, and Audit Trail are unchanged and non-negotiable. The
  harness constrains what the model may use and whether its output may ship —
  not how it investigates.
- Evidence Protocol per-case-type tables are soft reference configuration
  (data), not code and not a hard dependency. The model reads a table to know
  what counts as sufficient evidence — the maturity bar — for that case type and
  converges two-way (confirm, or rule out a false positive); the table is not a
  fetch-order checklist. The v1 Linux shell evidence table therefore lives in
  `docs/designs/`, not in the core.
- The model's freedom is limited to "which typed tool, with which parameters,"
  never raw command emission (per the research report's governance rules). The
  tool allowlist remains the deterministic capability surface.
- Runaway and sparse-signal risk is bounded by the Agent Run's own limits (step
  and budget caps), the gates, and Evidence Protocol gap-degrade — not by a fixed
  path. v1 accepts lower path reproducibility (the Audit Trail still records the
  path actually taken) and a larger-model requirement; small-model insertion
  points come later, after traces are recorded.
- Multi-agent self-selected collaboration (the full blackboard form) stays
  post-v1 (Mastra era). v1 is a single worker-loop, single-agent run. "Don't
  hardcode the planner" is the only part adopted now.
- "plan" in the Agent Loop glossary entry is satisfied by the model's in-run
  planning, so Agent Loop needs no change. A new Agent Run glossary term is added
  to disambiguate one bounded execution from the loop pattern (Agent Loop) and
  the queued work unit (Agent Job).
