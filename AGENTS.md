# AGENTS.md

This file provides guidance to Codex/Claude Code when working with code in this repository.

This project builds a security operations agent harness product.
The product is API-first: the Harness Service API is the product surface, and any operator UI is a consumer of it.

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
 

## Agent skills

### Domain docs

This repo uses a single-context domain docs layout. See `docs/agents/domain.md`.

## Conventions
- Don't overuse git operations; use them only when necessary, and only on files within your editing scope.
- Checkpoint-commit a decision once it hardens instead of piling up uncommitted reasoning.
- your commit with `--author="yourname <youremail>"`
  example:"claude <noreply@anthropic.com>".
- Commit style matches history: `docs(...):` / `docs:`. 
  Prefer editing a doc over adding one; new ADRs are `000N-*.md`, specs are `YYYY-MM-DD-*.md`.
- Speak to user in Chinese.

## Claude guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. 

### 1. plan Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- Transform tasks into verifiable goals, , state a brief multi-step tasks plan.
- Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
- If multiple interpretations or a simpler approach exist, present them - don't pick silently.
- Push back exact planning when warranted. If you finds wrong during implement, go back planning.

### 2. Simplicity First

- judge and simplify your overcomplicated code.
  if 200 lines equals 50 lines:
    use: 50 lines
    
### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Never "improve" adjacent code, comments, formatting or refactoring things  if it's not a refactor task.
- Don't create new code architechture, first find out if the problem be solved based on existing structure.
- Don't delete unrelated dead code , mention it.
- Avoid overwriting any existing files by creating a same-name file inforce, you should use another name or edit an existing file after checking instead.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request/task goal.
