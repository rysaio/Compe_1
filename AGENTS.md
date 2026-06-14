# AGENTS.md

This file provides guidance to Codex/Claude Code when working with code in this repository.

This is a start-stage repo, doing the first code.

This project builds a security operations agent harness product.
The product is API-first: the Harness Service API is the product surface, and any
operator UI is a consumer of it.

You (Claude/Codex) should defer to the relevant docs in exact missions.

## Project Documentation

Durable project knowledge lives in `CONTEXT.md` and `docs/`; promote anything
durable upward into the right layer below.

| # | Location | Usage | 
|---|----------|-------|
| 1 | `CONTEXT.md` | domain glossary — stable term meanings, not a plan | 
| 2 | `docs/adr/` | decision records — what was decided, status, why; thin, point to the design, don't carry it |
| 3 | `docs/designs/` | design substance — what the system is and how it's built; scope, assumptions, acceptance criteria | 
| 4 | `docs/research/` | user-managed exploration — expansion directions, summaries, open questions, ideas | 
| 5 | `docs/agents/domain.md` | how agents align design expressions in this repo | 

## Edit rules

- **Editing in an area** → read the doc that owns the subject first. Ownership is
  by subject, not a single ranked ladder:
  - term meaning → `CONTEXT.md`
  - design substance (what the system is / how it's built) → `docs/designs/`
  - whether something is decided and what was decided → `docs/adr/` (thin records
    that point into `docs/designs/` for the substance)
  - exploration / expansion material → `docs/research/` (user-managed)

  On a conflict, the layer that owns *that subject* wins. An ADR records a
  decision; it does not carry the design — follow its link into `docs/designs/`.
- **About to edit any file** → run `git status` / `git diff` first. Other agents
  (Codex, Claude) may share this tree. Avoid overwriting any existing files by creating a same-name file, use another name or edit the existing file instead. *Must check before write*.

## Agent skills

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
- Speak to user in Chinese.
