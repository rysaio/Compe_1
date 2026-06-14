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

## 下一步之后的方向（roadmap）

bare loop 跑通后按依赖顺序补齐——这批正是 bare-loop spec「不在」列出的延期项：

1. **审批与安全门实化** — Policy Gate 服务端签名 + 完整确定性策略门；Evidence
   Protocol 规则（首张 = v1 Linux shell 证据表，per-case-type config，依据 ADR 0003）。
2. **持久化与运行时** — Postgres 取代内存端口作唯一真值源；pg-boss 队列 + worker
   loop 租约执行 Agent Job；补上 bare loop 有意省略的 Case Work Item + Agent Job 包裹
   （awaiting_approval → 新 Job 层）。
3. **服务面** — Next.js 暴露 Harness Service API，可选 reference operator UI 作消费方。
4. **首个垂直切片（ADR 0002）** — Linux 服务器可疑 shell 执行：Wazuh auditd execve 信号
   走 Signal Intake → Wake Gate → Case → Run → Policy Gate → Operator Attention →
   Action Executor → Audit Trail；配套 Linux 探针集（进程树、`ss`/连接、base64 解码、
   IP 信誉）。
5. **外部组件实化** — Evidence Tools 由 stub 换真实探针；Source adapter 产出 Normalized
   Signal；Wake Gate 接持久监控平台告警流做过滤。

更远的升级触发器（不默认引入，详见 ADR 0001）：**Mastra**（agent 层 tool registry /
evals / tracing / memory）、**Temporal**（长时耐久 / 崩溃恢复 / 补偿 / 人工等待）。

## 约定（AGENTS.md）

- 提交 `--author="claude <noreply@anthropic.com>"`，风格 `feat(...):` / `test(...):`。
- 按主题归属裁决：术语→CONTEXT，设计→designs，决策→adr。写前 `git status`。
- 不擅自改 ADR / 设计。先让 automatic 端到端跑通，再加 human 审批 resume；bare loop
  阶段不造 Policy Gate / Evidence Protocol / Case Work Item 的完整实现。
