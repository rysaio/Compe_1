# 前置闸门与自我修正指引 — 设计规格

> 2026-06-19 · 决策见 `docs/adr/0005-precondition-gating-and-self-correction.md`
> · 立场承袭 ADR 0003（确定性在边界、不在调查路径）/ ADR 0004（核心是通用 Agent Loop）
>
> **Status: 已对齐，待实现** —— 本规格定义"接口自校验前置 + 缺则不执行并返回结构化自我
> 修正指引"的机制实质。前置标识集的 Postgres 持久化随 `2026-06-15-bare-agent-loop.md`
> 的 Postgres 层一并延期，先用内存适配器（同 `AuditTrail` / `RunStore`）。

## 背景与目标

"信任模型、控制边界"：不在调用前给模型预设边界，只把接口暴露给它、随它怎么调；每个接口
在**调用时**于内部做确定性边界校验。模型保有最大探索自由，业务流程、Policy Gate、安全
运营动作、会话状态仍按预期、可恢复、可审计地执行。这是 ADR 0003"整段调查、运行期"立场
在"单次接口调用、调用时"这一粒度上的补全——同一哲学（确定性放在边界），细一级。

目标：

- 接口缺前置 → **不执行**，返回**结构化自我修正指引**，而非死路。
- 前置依赖**配置化**（与代码解耦），一处通用求值器，零重复编码。
- 标识有**独立、结构化、可查**的当前状态源，Audit Trail 仅做历史镜像。

## 机制

1. **暴露面**：接口照常暴露给模型，不在 prompt 里预设/剧透前置。
2. **调用时硬校验**：进 `execute` 前，通用求值器按"前置依赖表"里该接口的规则，对"前置
   标识集"求值。
   - 满足 → 执行；成功后写下该接口自己的标识。
   - 不满足 → **不执行**，返回结构化指引（由"规则 + 缺哪个标识"自动生成）。
3. **确定性可重复**：指引不是放行。下一次调用若前置仍缺，照样拦——不存在"第二次自动通过"。
4. **审计分工**：标识写入/转移记一笔进 Audit Trail（历史）；"标识现在在不在"由标识集回答
   （当前状态）。

## 前置标识集（Precondition Marker set）

- 以 **Operational Case** 为作用域的结构化标识集合（同一 Case 跨 Agent Run 持续可见、可恢复）。
- 标识是最简的存在性键：
  - 调用痕迹型：`called:<interfaceId>`（"某接口成功调过"）。
  - 命名条件型：`approved:<action>`、`evidence_complete` 等（推广形态，与调用痕迹同集同形）。
- 唯一前置真相源，独立于 Audit Trail。Postgres 持久化（先内存适配器）。
- 例：`{ called:triage, evidence_complete, approved:blockIp }`

## 前置依赖表（Precondition Table）+ 规则文法

- 声明式 **config-as-data**：接口 id → 前置规则。改依赖 = 改表，不动接口代码。
- 规则是 Precondition Marker 上的布尔式，**最小文法**（保持克制）：
  - `allOf: [marker, ...]` —— 全满足（AND）
  - `anyOf: [marker, ...]` —— 满足其一（OR）
  - `atLeast: { k, of: [...] }` —— 满足其中 k 个（k-of-n）
  - 可一层嵌套表达 `A AND (B OR C)`：`allOf: [A, { anyOf: [B, C] }]`
- 例：
  ```yaml
  blockIp:      { allOf: [evidence_complete, "called:triage"] }
  concludeCase: { anyOf: [evidence_complete, analyst_override] }
  ```
- 与 Evidence Protocol 表**同族**（都是 data 不是 code），区别是强制力：Evidence Protocol
  表是**软**的（模型读、当成熟度标尺、双向收敛）；前置依赖表是**硬**的（求值器读、缺则不执行）。

## 通用求值器（一次编写，套住所有接口）

```
evaluate(rule, markerSet) -> { ok: true }
                           | { ok: false, missing, guidance }
```

- 纯函数：读规则 + 读标识集，判定 + 生成指引，无副作用。
- 指引由规则结构**自动生成**：
  - `allOf` 缺 X,Y → "需要先满足 X 和 Y"
  - `anyOf` 全缺 → "需要先满足 X 或 Y 之一"
  - `atLeast` → "需要先满足 […] 中至少 k 个，当前 m 个"
- 求值器不感知具体接口；新增接口只往表里加一行。

## 自我修正指引 schema（结构化、非自由文本）

返回给模型的拦截结果是类型化对象，便于审计与测试：

```json
{
  "status": "precondition_unmet",
  "interface": "blockIp",
  "rule": { "allOf": ["evidence_complete", "called:triage"] },
  "missing": ["evidence_complete"],
  "suggestedNext": ["<能产出 evidence_complete 的接口>"],
  "message": "先完成证据收集（evidence_complete）再执行 blockIp。"
}
```

- 进 Audit Trail（`kind: precondition_unmet`），与正常 `tool_result` 并列。

## 接入现有 core

- `core/tools.ts` 每个 tool 现有 `execute`。落地为**一个统一 execute 包装器**：
  - `wrap(tool, interfaceId)`：进 `execute` 前 `evaluate(table[interfaceId], markerSet)`；
  - 缺 → 返回 `precondition_unmet` 指引对象（不进 `execute`）；
  - 齐 → 进 `execute`，成功后 `markerSet.add("called:<interfaceId>")`（或该接口声明产出的
    命名标识）。
- 一处包装套住 `allTools`，零重复编码。
- **Policy Gate 即表中一行**（`approved:<action>` 标识），强制力不变：AC-6 仍成立——真实
  动作在缺 approval 标识时不执行。现有审批路径（`needsApproval` / `resumeAgentLoop`）与本
  机制叠加：审批通过即写 `approved:<action>` 标识。

## 与 ADR 0003 的一致性边界（防退化）

- 前置依赖表是 config 不是 code、可按 case 类型/部署替换 → 不把任何 case 类型焊进核心，与
  ADR 0003 对"固定 evidence DAG / playbook 焊进核心"的否决一致。
- **硬约束**：表里只写**真实依赖与安全条件**（没证据不能下结论、没批准不能执行），**绝不**写
  彼此独立取证工具之间的调用顺序——后者会从后门重建被否决的固定 playbook。
- 表保持小、可评审；新增前置须能说清它编码的是真实依赖而非流程偏好。

## 范围

**在**：前置标识集（内存适配器）、前置依赖表 + 最小规则文法、通用求值器（纯函数）、指引
schema、`allTools` 的 execute 包装、`precondition_unmet` 审计事件。

**不在**：标识集的 Postgres 持久化（随 bare loop 的 Postgres 层）、规则的运营态可视化编辑、
跨 Case 的标识、命名条件型标识的完整推广（先支持 `called:<id>`，`approved:` 随 Policy Gate
阶段，`evidence_complete` 随 Evidence Protocol 阶段）。

## 验收

- **AC-1** 接口缺前置时不进入 `execute`，返回结构化 `precondition_unmet` 指引。
- **AC-2** 前置满足关系支持 AND / OR / k-of-n，且来自配置表而非接口内硬编码。
- **AC-3** 同一前置仍缺时重复调用，重复拦截（无"第二次放行"）。
- **AC-4** "标识是否存在"由标识集判定，不扫 Audit Trail；标识转移仍写入 Audit Trail。
- **AC-5** 新增/调整某接口前置 = 改表，不改接口 `execute` 代码。
- **AC-6** 表只含真实依赖/安全条件；不含独立取证工具间的顺序前置。
