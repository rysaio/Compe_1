# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists - it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** - read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.
- **`docs/designs/`** - read aligned specs when planning or implementing a scoped feature or architectural slice.
- **`docs/research/`** - read research reports when the task depends on external systems, security tooling, or unresolved recommendations.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```text
/
|-- CONTEXT.md
|-- docs/
|   |-- README.md
|   |-- adr/
|   |   |-- 0001-event-sourced-orders.md
|   |   `-- 0002-postgres-for-write-model.md
|   |-- designs/
|   |-- research/
|   `-- agents/
`-- src/
```

Multi-context repo (presence of `CONTEXT-MAP.md` at the root):

```text
/
|-- CONTEXT-MAP.md
|-- docs/adr/                          <- system-wide decisions
`-- src/
    |-- ordering/
    |   |-- CONTEXT.md
    |   `-- docs/adr/                  <- context-specific decisions
    `-- billing/
        |-- CONTEXT.md
        `-- docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal - either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Respect document authority

Use this order when two documents overlap:

1. `CONTEXT.md` owns domain terms.
2. `docs/adr/` owns accepted decisions.
3. `docs/designs/` owns aligned specs and acceptance criteria.
4. `docs/research/` owns evidence and candidate recommendations.
5. `.claude/artifacts/` owns tool workspace outputs only.

If a `.claude/artifacts/` file and a `docs/` file describe the same topic,
prefer the `docs/` file unless the user explicitly asks to inspect raw tool
output.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) - but worth reopening because..._
