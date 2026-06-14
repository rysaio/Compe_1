# Handoff — Bare Agent Loop (code)

**Worktree**: `worktree-agent-loop-core` · **Stage**: docs→code，零代码起步
**Language**: 中文回应用户

## 任务

用 TDD 构建第一个 bare Agent Loop — observe-plan-act-record 端到端，每步写
Audit Trail。实现规格见 `docs/designs/2026-06-15-bare-agent-loop.md`。

目标形态：Wake Gate=退化 prompt 入口，Evidence Tools=1-2 个 typed stub，
Policy Gate/Evidence Protocol=最小骨架，loop 先跑通再加安全考量。

## 关键技术方向

- **`ai@6.0.205`** + `@ai-sdk/openai-compatible`（非 Anthropic 专属）
- **`tool()` 用 `inputSchema`**（v6 改名），不用 `dynamicTool()`
- **Evidence Tools = automatic**（`needsApproval` 缺省），**Action Tools = human**（`needsApproval: true`）
- **automatic 路径**：`ToolLoopAgent` + `onStepFinish` 流式写 Audit Trail
- **human 审批路径**：`generateText` 两次调用（SDK 返回 `tool-approval-request` → 存 messages → append `tool-approval-response` → 二次调用恢复）
- **审批 resume 只到 SDK messages 层**，不包 Case Work Item + 新 Job（与 ADR 0001:70-73 有张力，已标记在设计文档，不改 ADR）
- **单包 `core/`**，端口+内存适配器先行，Postgres 后接
- **测试接真实 OpenAI-compatible provider**，API key + baseURL 走环境变量

## 重要提醒

0. **这是 Vercel AI SDK v6。** 不要用 v5 API（`parameters`→`inputSchema`、`Agent`→`ToolLoopAgent`）。
1. **先读文档再写代码。** `docs/designs/2026-06-15-bare-agent-loop.md`（栈+审批+张力）、
   `docs/adr/0001-v1-technology-direction.md`、`docs/adr/0004-core-is-a-general-agent-loop.md`。
   不要重推导已定结论。
2. **遵守 AGENTS.md 约定**：提交 `--author="claude <noreply@anthropic.com>"`，
   风格 `feat(...):` / `test(...):`，authority CONTEXT.md > adr > designs > research，
   写前 `git status`。
3. **不擅自改 ADR。**
4. **先让 automatic 端到端跑通**，再加 human 审批 resume。不在 bare loop 阶段造
   Policy Gate / Evidence Protocol / Case Work Item 的完整实现。
