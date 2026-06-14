# ADR 0004: The core is a general Agent Loop; Wake Gate and Evidence Tools are external components

Status: Accepted
Date: 2026-06-14

Design: `docs/designs/2026-06-07-v1-technology-selection.md`
 (core architecture, approval boundary, and the pluggable external components)

## Decision

The product core is a general observe-plan-act-record Agent Loop — the same shape
as a general-purpose agent — specialized for security only by its skills, prompts,
workflow guidance, and a two-path approval boundary (human approval plus automatic
rule-based approval: Policy Gate and Evidence Protocol). Wake Gate, Evidence Tools,
and the input/source adapter are decoupled, pluggable external components, not
core: the Wake Gate is just "what triggered one Agent Run" — a persistent
monitoring platform when attached, or a single human prompt when not. Detach those
components and the bare Agent Loop still runs; that loop is the heart of the
product.

## Consequences

- This is the concrete form of ADR 0003's north star, "an embeddable agent engine,
  not a SOC platform."
- The first coding step is the bare loop — Wake Gate as a prompt entrypoint,
  Evidence Tools as stubs, Policy Gate and Evidence Protocol as minimal skeletons.
- The core stays agnostic to which external components are attached; adding or
  swapping one is a plugin change, not a core change.
