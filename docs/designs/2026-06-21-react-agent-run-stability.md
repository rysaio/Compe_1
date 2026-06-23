# ReAct Agent Run Stability — 代码实现规格

> 2026-06-21 · 承接 `2026-06-15-bare-agent-loop.md`、ADR 0003、ADR 0004、ADR 0005。
> 本文是代码落地切片，不改变既有架构决策。

## 目标

把当前 `core/` 里的 Agent Loop 进一步落实成可运行、可测试、可由调用方稳定判断结果的
ReAct-style Agent Run。这里的 "ReAct" 指模型在一个有界 Agent Run 内反复发起工具调用、
接收工具返回、再继续模型调用直到停止、触顶或等待审批；不是引入新的框架或新的运行时。

## 当前基线

已有实现：

- `runAgentLoop()` 用 `generateText()` + `stopWhen` 驱动多步模型调用。
- automatic tools 通过 `experimental_onToolCallFinish` 记录 `tool_result`。
- action tools 通过 `needsApproval: true` 暂停，`resumeAgentLoop()` 在审批后第二次调用模型。
- Precondition Table 在 `execute` wrapper 内硬校验，缺前置时返回结构化自我修正指引。

缺口：

- 调用方只能看到 `status`，无法直接知道最终 `finishReason`、模型步数、工具执行次数，或暂停时
  的 approval 细节。
- 调用方若要判断多轮工具返回是否稳定运行，只能反查 Audit Trail；这不适合作为核心 API 的
  最小可运行契约。

## 本切片范围

在：

- 扩展 `RunResult`，让 `runAgentLoop()` / `resumeAgentLoop()` 返回本次调用的运行摘要。
- 摘要字段来自已有 SDK callback：
  - `steps`: `onStepFinish` 次数。
  - `toolExecutions`: `experimental_onToolCallFinish` 次数。
  - `finishReason`: SDK `generateText()` 的最终 `finishReason`，审批 denial 用 `action_denied`。
  - `pendingApproval`: 暂停路径的 `toolCallId`、`toolName`、`approvalId`、`input`。
- 保持 Audit Trail 是持久历史真相源；返回摘要只是本次调用结果。

不在：

- Postgres / pg-boss / Agent Job 包裹层。
- Harness Service API endpoint。
- 新工具、新模型 provider、真实 Wazuh/WAF/邮件适配器。
- 把独立 Evidence Tools 排成固定顺序。

## 返回契约

`RunResult`：

```ts
{
  runId: string;
  status: RunStatus;
  finishReason?: string;
  steps: number;
  toolExecutions: number;
  pendingApproval?: {
    toolCallId: string;
    toolName: string;
    approvalId: string;
    input: unknown;
  };
}
```

语义：

- `completed` + `finishReason: "stop"`：本次有界循环正常完成。
- `completed` + `finishReason: "action_denied"`：操作被人工拒绝，run 有界结束，没有第二次模型调用。
- `awaiting_approval` + `pendingApproval`：模型请求 action tool，SDK 暂停，等待操作员决策。
- `failed` 不作为返回值；异常仍抛出，同时 `RunStore` 标记 failed，Audit Trail 写 `run_finished` error。

## 验收

- AC-1 automatic path: 两轮模型调用、一轮工具执行后，返回 `status: completed`、
  `finishReason: stop`、`steps >= 2`、`toolExecutions: 1`。
- AC-2 approval pause: action tool 请求后，返回 `status: awaiting_approval`、
  `pendingApproval.toolCallId` 与审计记录一致。
- AC-3 approval resume: 批准后继续模型调用并完成，返回 `status: completed`、
  `finishReason: stop`、`toolExecutions >= 1`。
- AC-4 denial: 拒绝后不再调用模型，返回 `finishReason: action_denied`。
- AC-5 `npm test` 与 `npm run typecheck` 通过。
