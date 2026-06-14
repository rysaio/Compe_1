# Handoff — Bare Agent Loop (code)

**Worktree**: `worktree-agent-loop-core` · **Stage**: docs→code，零代码起步
**Language**: 中文回应用户

## 任务

用 TDD 构建第一个 bare Agent Loop — observe-plan-act-record 端到端，每步写
Audit Trail。目标形态：Wake Gate=退化 prompt 入口，Evidence Tools=1-2 个 typed
stub，Policy Gate/Evidence Protocol=最小骨架，loop 先跑通再加安全考量。

## 先读这些（不要重推导已定结论）

- **`docs/designs/2026-06-15-bare-agent-loop.md`** — 实现规格：技术栈版本、审批路径、
  实现方式、范围、与核心设计的张力。**这是本任务的细节家。**
- **`docs/designs/2026-06-07-v1-technology-selection.md`** — 核心架构 / 技术栈设计。
- **`docs/adr/0001`（栈决策）+ `0004`（核心=通用 Loop）** — 决策与状态。

## 约定（AGENTS.md）

- 提交 `--author="claude <noreply@anthropic.com>"`，风格 `feat(...):` / `test(...):`。
- 按主题归属裁决：术语→CONTEXT，设计→designs，决策→adr。写前 `git status`。
- 不擅自改 ADR / 设计。先让 automatic 端到端跑通，再加 human 审批 resume；bare loop
  阶段不造 Policy Gate / Evidence Protocol / Case Work Item 的完整实现。
