# The core is a general Agent Loop; Wake Gate and Evidence Tools are external components

The product core is a general observe-plan-act-record Agent Loop — the same shape
as a general-purpose agent — specialized for security only by its skills,
prompts, workflow guidance, and a two-path approval boundary (human approval plus
automatic rule-based approval: Policy Gate and Evidence Protocol). Wake Gate and
Evidence Tools (and the input/source adapter) are decoupled, pluggable external
components, not core: the Wake Gate is just "what triggered one Agent Run" — a
persistent monitoring platform when attached, or a single human prompt when not.
Detach those components and the bare Agent Loop still runs; that loop is the
heart of the product. This is the concrete form of ADR 0003's north star, "an
embeddable agent engine, not a SOC platform," and it makes the first coding step
the bare loop — Wake Gate as a prompt entrypoint, Evidence Tools as stubs, Policy
Gate and Evidence Protocol as minimal skeletons.
