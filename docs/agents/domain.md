# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** - read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.
- **`docs/designs/`** - read aligned specs when planning or implementing a scoped feature or architectural slice.
- **`docs/research/`** - read research reports when the task depends on external systems, security tooling, or unresolved recommendations.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo's current layout - single-context:

```text
/
|-- CONTEXT.md
|-- CLAUDE.md       #linked to AGENTS.md for Claude Code
|-- AGENTS.md
`-- docs/
    |-- adr/
    |-- designs/
    |-- research/
    |-- agents/
        |-- issue-tracker.md
        |-- triage-labels.md
        `-- domain.md
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal - either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR 0001 (v1 technology direction) - but worth reopening because..._
