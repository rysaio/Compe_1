# Bare Agent Loop — 实现规格

> 2026-06-15 · 基于 ADR 0001 + ADR 0004 · 核心架构见 `2026-06-07-v1-technology-selection.md`
>
> **Status: 已实现** — bare loop 在 `core/` 落地(两条审批路径 + Audit Trail + RunStore +
> 经典/SOC tool stubs),单元测试与真实 provider 集成测试均通过；公共面见 `core/README.md`。
> **下一增量**(本规格「与核心设计的张力」节 + ADR 0001/0004 的 Consequences 已指明,非新决策):
> **Policy Gate 阶段** —— 把 Policy Gate 从骨架做成确定性审批,补上本阶段有意省略的 Postgres
> 持久化与 Case Work Item / Agent Job 包裹层,朝 ADR 0002 的 Linux 服务器可疑 shell 垂直切片推进。
> 延期组件的完整清单见 `core/README.md` 的「Scope and deferred items」。

## 技术栈

- `ai@6.0.205` · `zod@^3.25` · `@ai-sdk/openai-compatible`
- 测试接真实 OpenAI-compatible provider，需 API key（baseURL + key 走环境变量）
- 单包 `core/`，端口+内存适配器，Postgres 后接
- `tool()` 用 `inputSchema`（v6 改名，非 `parameters`）
- 不用 `dynamicTool()`（v6 不支持 `needsApproval`，[issue #11434](https://github.com/vercel/ai/issues/11434)）

## 审批路径

- **Evidence Tools**：`needsApproval` 缺省 → automatic，无人值守
- **Action Tools**：`needsApproval: true` → 返回 `tool-approval-request`，二次调用恢复

## 实现方式

- automatic 路径：`ToolLoopAgent` + `onStepFinish` 流式写 Audit Trail
- human 路径：`generateText` 两次调用（docs 已验证；ToolLoopAgent 的审批 resume 未文档化）

## 与核心设计的张力

核心设计（`2026-06-07-v1-technology-selection.md` →「How the Agent Loop is built」）描述 Run 终止→`awaiting_approval` Case Work Item→新 Job。Bare loop 直接用 SDK messages 暂停/恢复，不包 Case Work Item+Job 层。**这是有意裁剪（Policy Gate 阶段再做），不改设计。**

## 范围

在：TS 单包 `core/`，AuditTrail+RunStore 端口+内存适配器，Evidence/Action tool stubs，
ToolLoopAgent automatic 路径，generateText human 审批 resume，onStepFinish 流式审计。

不在：Postgres/pg-boss/worker loop/Next.js，Policy Gate 签名，Evidence Protocol 规则，
Wake Gate（仅退化 prompt 入口），Case Work Item/Job 包裹，4 个开放合约。
