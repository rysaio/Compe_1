# Bare Agent Loop — 实现规格

> 2026-06-15 · 基于 ADR 0001 + ADR 0004

## 技术栈

- `ai@6.0.205` · `zod@^3.25` · `@ai-sdk/openai-compatible`
- `MockLanguageModelV3` from `ai/test`（测试用，无需真 key）
- 单包 `core/`，端口+内存适配器，Postgres 后接
- `tool()` 用 `inputSchema`（v6 改名，非 `parameters`）
- 不用 `dynamicTool()`（v6 不支持 `needsApproval`，[issue #11434](https://github.com/vercel/ai/issues/11434)）

## 审批路径

- **Evidence Tools**：`needsApproval` 缺省 → automatic，无人值守
- **Action Tools**：`needsApproval: true` → 返回 `tool-approval-request`，二次调用恢复

## 实现方式

- automatic 路径：`ToolLoopAgent` + `onStepFinish` 流式写 Audit Trail
- human 路径：`generateText` 两次调用（docs 已验证；ToolLoopAgent 的审批 resume 未文档化）

## 与 ADR 0001 的张力

ADR 0001:70-73 描述 Run 终止→`awaiting_approval` Case Work Item→新 Job。Bare loop 直接用 SDK messages 暂停/恢复，不包 Case Work Item+Job 层。**这是有意裁剪（Policy Gate 阶段再做），不改 ADR。**

## 范围

在/不在见 HANDOFF.md:92-97。
