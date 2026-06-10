# Security Operations Harness — Agent Guide

AGENTS.md is the agent entry point for this repo. There is no CLAUDE.md by design — do
not create one. Tool-agnostic agents (Claude, Codex) all start here, then defer to the
docs below for vocabulary, decisions, and the doc map.

## Start here

1. `docs/README.md` — doc map, reading order, and authority model.
2. `CONTEXT.md` — domain glossary (stable terms; each carries an _Avoid_ synonym list).
3. `docs/adr/` — accepted decisions (ADR 0001 = v1 technology direction).
4. `docs/designs/` — aligned specs that feed ADRs.
5. `docs/research/` — evidence and candidate ideas (lowest authority; `inbox.md` holds unpromoted notes).

The authority order on overlap, and the rule that `.claude/artifacts/` is a throwaway
tool workspace, are defined in `docs/README.md` and `docs/agents/domain.md`. Follow them;
do not restate them here.

## North star

This project builds a security operations harness, not a one-shot chatbot or a fixed
workflow — the model is the reasoning engine inside a persistent, bounded agent loop.
The product is API-first: the Harness Service API is the product surface, and any
operator UI is a consumer of it. The v1 integration posture is probe-first,
Wazuh-compatible. Every load-bearing term (harness, agent loop, Harness Service API,
Signal Collectors) is defined in `CONTEXT.md`; the accepted v1 technology direction and
its boundaries are owned by ADR 0001 (`docs/adr/0001-v1-technology-direction.md`). Defer
to both — do not restate them here, and flag explicitly if your work contradicts them.

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout. See `docs/agents/domain.md`.

## Conventions

- **Vocabulary discipline**: when naming a domain concept (issue title, commit, test,
  proposal), use the `CONTEXT.md` term and never drift to a listed _Avoid_ synonym. If a
  concept isn't in the glossary, that's a signal — note it for `/grill-with-docs`, don't
  invent one.
- **Flag ADR conflicts**: if your output contradicts an ADR, surface it explicitly
  (e.g. "Contradicts ADR 0001 — worth reopening because…"); never silently override.
- **Git authorship**: commit your own completed changes under your own author —
  `git commit --author="Codex <codex@openai.com>"` or
  `git commit --author="claude <noreply@anthropic.com>"`. Do not add the human as a
  co-author unless explicitly asked.
- **Multi-agent coordination**: Codex and Claude both operate in this repo against one
  shared doc set and vocabulary. Run `git status` and `git diff` before editing; let only
  one agent edit a given file group at a time; checkpoint-commit design decisions as they
  crystallize; use separate branches or git worktrees for parallel work rather than the
  same working tree.
