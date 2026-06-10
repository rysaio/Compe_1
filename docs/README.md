# Project Documentation

This repo keeps durable project knowledge under `docs/`. Tool-generated working
files may appear under `.claude/artifacts/`, but that directory is only a
temporary skill workspace. Do not keep explanatory or canonical documentation
there; promote anything durable into `docs/`, `CONTEXT.md`, or an ADR.

## Reading Order

1. `CONTEXT.md` for the project domain language.
2. `docs/adr/` for accepted architecture and product-shaping decisions.
3. `docs/designs/` for aligned specs that feed implementation plans or ADRs.
4. `docs/research/` for evidence, platform notes, candidate ideas, and open
   recommendations.
5. `docs/agents/` for agent-consumer rules such as issue tracker, triage
   labels, and domain-doc layout.

## Authority Model

- `CONTEXT.md` owns stable domain terms. It is a glossary, not a plan.
- `docs/adr/` owns accepted decisions and their consequences.
- `docs/designs/` owns aligned design inputs, scopes, assumptions, acceptance
  criteria, and unresolved decision prompts.
- `docs/research/` owns supporting evidence and exploratory recommendations.
- `docs/agents/` owns how agent skills should consume this repo.
- `.claude/artifacts/` is a temporary tool workspace. Ignore it unless a task
  explicitly asks to inspect raw skill output.

## Current Map

- `docs/adr/0001-v1-technology-direction.md`: accepted v1 technology direction.
- `docs/designs/2026-06-07-v1-technology-selection.md`: source design spec for
  ADR 0001.
- `docs/research/security-systems-and-agent-integration.md`: security platform
  and agent integration research that informs probe-first, Wazuh-compatible
  architecture.
- `docs/research/inbox.md`: research inbox for loose ideas before promotion.
