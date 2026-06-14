# Handoff — MVP 规划阶段（首个垂直切片）

**Stage**: bare loop 已完成 → 推进「完整最小可用形态」MVP 的计划 / 代码架构 / 资料搜集
**Language**: 中文回应用户

## 一句话状态

bare Agent Loop core 已写完、合并入 `main`、验证通过（`21 passed | 2 skipped`）。
下一焦点 = Request D：**推进 agent 应用「完整最小可用形态」的计划、代码架构、资料搜集（交子代理做）**。

## 已完成（不要重做）

- **bare Agent Loop core 已落 `main`**：`core/` 单包。技术栈 / 端口 / 双审批路径 / 每步审计的
  细节见 `core/README.md` 与 `docs/designs/2026-06-15-bare-agent-loop.md`，勿重推导。
- **worktree tournament（3 子代理择优）已收尾**：胜者合并，其余 worktree / 分支已清，仅余 `main`。
- **文档去重 + 主题归属重组已完成**：见 `AGENTS.md` 编辑规则、ADR 0001/0004 瘦身、
  design `2026-06-07-v1-technology-selection.md` 整合。
- **验证**：`cd core && npm install && npm test` → `21 passed | 2 skipped`。
  集成测试在无 `.env` 时 skip（胜者实现未带 dotenv，可作一行 follow-up 补上）。
- **git**：`main` 领先 `origin/main` **2 个未推送提交**（`a215fd2` core + `b6be055` chore）。
  用户尚未明确要求 push 这两个 — 进任何操作前先 `git log origin/main..main` 复核。

## 当前任务清单状态

- `#10` 并行派发 5 个资料搜集子代理 — **进行中**（尚未实际派发，被 /compact + /handoff 打断）。
- `#11` 综合研究产出，编写 MVP 计划 + 代码架构 — pending。
- `#12` 呈交 MVP 计划与架构待用户审阅 — pending。

## 下一步（Request D 执行计划）

1. **先过 brainstorming 的 HARD-GATE**：Request D 是开放式规划，动手前先与用户确认
   「最小可用形态」边界 + 要委派的研究主题，出设计并获批后再实现。
2. **并行派发 5 个只读研究子代理**（各域独立，互不依赖）：
   - **R1 运行时 & 队列** — pg-boss + Postgres worker loop（租约 / 重试 / 幂等 / 崩溃恢复）；
     迁移工具选型（drizzle / prisma / node-pg-migrate）；Temporal 升级线在哪。
   - **R2 数据模型 & 持久化** — Operational Case / Case Work Item（状态机）/ Agent Job /
     追加式 Audit Trail / Evidence / Operational Memory 的 Postgres schema；内存端口
     （AuditTrail、RunStore）→ Postgres 适配器映射；ORM / query-builder 选型。
   - **R3 AI SDK v6 生产模式** — 服务端工具审批；跨进程恢复（messages 持久化到 PG）；
     结构化输出（`generateObject`/zod 用于 Evidence Protocol 充分性判定、动作建议）；
     step / 预算上限；telemetry；provider 重试；流式到 API 面；何时值得上 Mastra。
   - **R4 服务面（Next.js API-first）** — route handler 模式、Harness Service API 端点、
     SSE 流、API-key 鉴权、zod 校验、OpenAPI / 类型化客户端、worker 进程与 Next.js 进程关系。
   - **R5 安全域切片（ADR 0002）** — Linux 服务器可疑 shell（Wazuh auditd execve）；证据探针
     （进程树 / 父链、`ss`/连接、base64 解码、IP 信誉服务 AbuseIPDB/GreyNoise/VirusTotal 的
     免费层与 API 形态、osquery）；该案型 Evidence Protocol 证据表内容；Wazuh 告警 →
     Normalized Signal 映射；动作执行器（封 IP / 隔离主机 / 杀进程）形态。
   - **子代理约束**：只读研究、不改文件、回结构化 findings（建议 + 关键 API/模式 + 坑 +
     版本注记 + 「如何映射到我们 MVP」+ 引用）。
3. **综合 findings → 写 MVP 设计文档到 `docs/designs/`**（注意已存在 `2026-06-15-bare-agent-loop.md`，
   用不同 topic 名避免同名）。内容：MVP 范围；代码架构（包 / 模块、core 如何扩展、端口 →
   PG 适配器、worker、Next.js API、切片探针 / 工具 / 门）；分阶段计划（对齐下方 roadmap 1–5）。
4. **呈交用户审阅**（brainstorming → writing-plans 的 gate），获批后再进实现。

## 下一步之后的方向（roadmap，MVP 的骨架）

bare loop 跑通后按依赖顺序补齐 —— 这批正是 bare-loop spec「不在」列出的延期项：

1. **审批与安全门实化** — Policy Gate 服务端签名 + 完整确定性策略门；Evidence Protocol 规则
   （首张 = v1 Linux shell 证据表，per-case-type config，依据 ADR 0003）。
2. **持久化与运行时** — Postgres 取代内存端口作唯一真值源；pg-boss 队列 + worker loop 租约
   执行 Agent Job；补上 bare loop 有意省略的 Case Work Item + Agent Job 包裹。
3. **服务面** — Next.js 暴露 Harness Service API，可选 reference operator UI 作消费方。
4. **首个垂直切片（ADR 0002）** — Linux 服务器可疑 shell 执行：Wazuh auditd execve 信号走
   Signal Intake → Wake Gate → Case → Run → Policy Gate → Operator Attention →
   Action Executor → Audit Trail；配套 Linux 探针集。
5. **外部组件实化** — Evidence Tools 由 stub 换真实探针；Source adapter 产出 Normalized
   Signal；Wake Gate 接持久监控平台告警流做过滤。

更远的升级触发器（不默认引入，详见 ADR 0001）：**Mastra**（agent 层 tool registry / evals /
tracing / memory）、**Temporal**（长时耐久 / 崩溃恢复 / 补偿 / 人工等待）。

## 先读这些（按路径引用，勿重推导已定结论）

- 本文件「roadmap」节 —— MVP 的阶段骨架。
- `docs/designs/2026-06-07-v1-technology-selection.md` — 核心架构 + 技术栈（设计真值源）。
- `docs/designs/2026-06-15-bare-agent-loop.md` — bare loop 实现规格（**已实现**）。
- `core/README.md` — 已实现 core 的公共面与用法。
- ADR `0001`（栈决策 + 升级触发器）/ `0002`（首个垂直切片）/ `0003`（model-driven
  investigation）/ `0004`（核心 = 通用 Loop）。
- `CONTEXT.md` — 术语表。
- `docs/research/security-systems-and-agent-integration.md` — 既有研究输入（R5 起点）。

## 约定 / 红线（详见 AGENTS.md）

- 提交 `--author="claude <noreply@anthropic.com>"`，无 human co-author；
  风格 `docs(...):` / `feat(...):` / `test(...):`。
- **`.env`（provider 凭据，已 gitignore）永不提交 / 打印其值**。provider 为 DashScope/Qwen
  OpenAI-compatible；无 model id —— 用 `process.env.OPENAI_MODEL ?? "gpt-4o-mini"`（实测用
  qwen 系列）。worktree 子代理需把根目录 `.env` `cp` 进各自 worktree（gitignore，勿提交）。
- 写前 `git status` / `git diff`。按主题归属裁决：术语 → CONTEXT，设计 → designs，
  决策 → adr，探索 → research（用户管）。不擅改 ADR / 设计未授权。
- 用中文回应用户。

## 建议调用的 skills（suggested skills）

- **superpowers:brainstorming** — Request D 是开放式规划；进实现前必须先出设计并经用户批准（HARD-GATE）。
- **superpowers:dispatching-parallel-agents** — 派发上述 5 个独立只读研究子代理。
- **superpowers:writing-plans** — 设计获批后转实现计划。
- **superpowers:using-git-worktrees** — 若 MVP 实现也走多 worktree 并行 / 择优。

## 未决（需用户拍板）

- MVP「最小可用形态」的精确边界（是否就 = ADR 0002 首个垂直切片端到端跑通 + Postgres + 服务面）。
- 5 个研究主题是否照单委派，还是增删 / 调整范围。
