# AGENTS.md

This file provides guidance to Codex/Claude Code when working with code in this repository.

This is a planning-stage repo, docs only, in the method of Domain-Driven-Design(DDD).

This project builds a security operations agent harness product.
The product is API-first: the Harness Service API is the product surface, and any
operator UI is a consumer of it.

You (Claude/Codex) should defer to the relevant docs when designing.

## Project Documentation

Durable project knowledge lives in `CONTEXT.md` and `docs/`; promote anything
durable upward into the right layer below.

| # | Location | Usage | 
|---|----------|-------|
| 1 | `CONTEXT.md` | domain glossary — stable terms, not a plan | 
| 2 | `docs/adr/` | accepted decisions and their consequences |
| 3 | `docs/designs/` | aligned specs — scope, assumptions, acceptance criteria | 
| 4 | `docs/research/` | supporting evidence and candidate ideas | 
| 5 | `docs/agents/domain.md` | how agents align design expressions in this repo | 

## Edit rules

- **Editing in an area** → read the ADR that owns it first (`docs/adr/`). On any
  overlap, authority is `CONTEXT.md` > `docs/adr/` > `docs/designs/` > `docs/research/`. Higher wins.
- **About to edit any file** → run `git status` / `git diff` first. Other agents
  (Codex, Claude) may share this tree. Avoid overwriting any existing files by creating a same-name file, use another name or edit the existing file instead. *Must check before write*.

## Agent skills

### Issue tracker(ignore now)

Issues are tracked as GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.(dont need it at the present)

### Triage labels(ignore now)

This repo uses the default triage label vocabulary. See `docs/agents/triage-labels.md`.(dont need it for now)

### Domain docs

This repo uses a single-context domain docs layout. See `docs/agents/domain.md`.

## Conventions

- Checkpoint-commit a decision once it hardens instead of piling up uncommitted 
  reasoning.
- your commit must with `--author="yourname <youremail>"`
  example:"claude <noreply@anthropic.com>".
  No human co-authored.  
- Parallel work → separate branch/worktree
- Commit style matches history: `docs(...):` / `docs:`. 
  Prefer editing a doc over adding one; new ADRs are `000N-*.md`, specs are `YYYY-MM-DD-*.md`.
