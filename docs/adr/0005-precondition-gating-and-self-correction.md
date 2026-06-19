# ADR 0005: Interfaces self-enforce config-driven preconditions and return self-correction guidance

Status: Accepted
Date: 2026-06-19

Design: `docs/designs/2026-06-19-precondition-gating-and-self-correction.md`
 (mechanism substance: marker set, precondition table + rule grammar, evaluator,
 guidance schema, core wiring)
Builds on: ADR 0003 (determinism on the boundary, not the investigation path),
 ADR 0004 (the core is a general Agent Loop).

## Decision

Expose interfaces to the model without pre-call restriction; enforce business and
safety boundaries inside each interface, at call time. Before an interface runs,
it checks a declared precondition rule:

- The rule is a boolean over **Precondition Markers** — `allOf` (AND), `anyOf`
  (OR), or `atLeast` k-of-n — not a flat AND. A marker records that a prior
  interface was called (`called:<interfaceId>`) or that a named condition holds
  (`approved:<action>`, `evidence_complete`).
- Rules live in a declarative **Precondition Table** (config as data), read by a
  single generic evaluator. The check is not hand-coded per interface; changing a
  dependency is a config change, not a code change.
- An unmet rule means the interface does **not** execute. Rather than dead-ending,
  it returns structured **self-correction guidance** ("call A or C before B"),
  derived from the rule and the missing markers, so the agent corrects itself.
- Enforcement is deterministic and repeatable: guidance is not a bypass. A second
  call with the precondition still unmet hits the same block — there is no
  "second time passes for free."
- Markers are the current-state source of truth: durable, queryable, and
  crash-recoverable across Agent Runs. The Audit Trail mirrors marker transitions
  as history but is not the precondition store.

This unifies sequencing preconditions and the Policy Gate under one shape: both
are hard, table-driven checks that block-and-guide instead of block-and-fail.

## Why now

A design thread — "trust the model, control the boundary" — asked how to keep the
agent maximally free to choose what to call while still guaranteeing that business
flow, the Policy Gate, security operations actions, and session state run as
expected, recoverable, and auditable. The answer is to take the boundary off the
prompt (no pre-call lecturing of the model) and put it inside the interface: a
hard, config-driven precondition check that, when it blocks, hands back a recovery
path. This is the call-time, per-interface complement to ADR 0003's run-time,
whole-investigation stance — same philosophy ("determinism on the boundary"), one
level finer.

## Considered Options

- **Config-driven precondition table + generic evaluator, block-and-guide
  (chosen).** Boundaries are data, evaluated once, enforced hard, and recoverable.
  Adding or changing a dependency is a config edit; the model stays free to
  explore; the agent never dead-ends. Generalises to new interfaces and case types
  by editing the table, matching the "embeddable agent engine, not a SOC platform"
  north star.
- **Soft advisory guidance the model may ignore (rejected).** Returning only a
  hint and letting the call proceed would fail AC-6 for security-critical actions:
  a real action could execute without its precondition. The check must hard-block;
  the guidance is the recovery affordance returned *on* the block, not a substitute
  for it.
- **Per-interface hand-coded precondition checks (rejected).** Repeats the check
  logic in every `execute`, makes a dependency change a code change in many places,
  and drifts toward a bespoke per-interface engine. Folded into the single
  table-driven evaluator.
- **Precondition state sourced from the Audit Trail (rejected).** The Audit Trail
  is append-only history; answering "does marker X hold now" by scanning it
  conflates audit with current state and scales poorly. A dedicated structured
  marker set is the truth source; the Audit Trail mirrors transitions.

## Consequences

- Two glossary terms are added to `CONTEXT.md`: **Precondition Marker** and
  **Precondition Table**.
- Determinism stays config-as-data, consistent with ADR 0003's ruling that the
  Evidence Protocol per-case-type tables are configuration, not code. The
  Precondition Table differs only in enforcement strength: Evidence Protocol is
  soft (the model reads it as a maturity bar), the Precondition Table is hard (the
  evaluator enforces it; an unmet rule means the call does not execute).
- Anti-playbook boundary, explicit and non-negotiable: the table encodes real
  dependencies and safety conditions only — never an investigation order among
  independent Evidence Tools. Encoding ordering among independent probes would
  rebuild the fixed playbook ADR 0003 rejected, through the back door.
- The Policy Gate becomes one row in the Precondition Table (an `approved:<action>`
  marker) rather than a separate code path, but its strength is unchanged: AC-6
  still holds — a real action does not execute until its approval marker exists.
  The human-approval path (needsApproval / resume) composes with this mechanism:
  granting approval writes the `approved:<action>` marker.
- In `core/`, this lands as one `execute` wrapper over `allTools`
  (`core/tools.ts`): evaluate `table[interfaceId]` against the marker set before
  `execute`; on pass, record the interface's marker. One wrapper covers every tool;
  no per-tool wiring.
- The marker set needs a durable structured store (Postgres). Like the
  AuditTrail / RunStore ports it ships first as an in-memory adapter, with the
  Postgres adapter deferred alongside the rest of the Postgres layer in the bare
  loop spec.
- Risk: precondition rules creeping into a de-facto playbook. Mitigated by the
  real-dependencies-only rule above and by keeping the table small and reviewed —
  a new precondition must justify the real dependency it encodes.
