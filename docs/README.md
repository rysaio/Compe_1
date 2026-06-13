# Project Documentation

Durable project knowledge lives in `CONTEXT.md` and `docs/`; promote anything
durable upward into the right layer below. `.claude/artifacts/` is a throwaway
tool workspace — never keep canonical docs there.

## Map and authority

Read top-down. On overlap, the higher row wins.

| # | Location | Owns | Files |
|---|----------|------|-------|
| 1 | `CONTEXT.md` | domain glossary — stable terms, not a plan | — |
| 2 | `docs/adr/` | accepted decisions and their consequences | `0001-v1-technology-direction.md`, `0002-v1-first-vertical-slice.md`, `0003-model-driven-investigation.md` |
| 3 | `docs/designs/` | aligned specs — scope, assumptions, acceptance criteria | `2026-06-07-v1-technology-selection.md` |
| 4 | `docs/research/` | supporting evidence and candidate ideas | `security-systems-and-agent-integration.md`, `inbox.md` |
| 5 | `docs/agents/` | how agents consume this repo | `issue-tracker.md`, `triage-labels.md`, `domain.md` |

`AGENTS.md` (repo root) is the agent entry point and points here.
