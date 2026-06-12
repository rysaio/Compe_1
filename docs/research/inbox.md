# Research Inbox

Loose notes, links, and candidate ideas live here before they are promoted into
a focused research report, design spec, issue, or ADR.

## Original Notes

Some misc points I picked from somewhere (Internet, Others, me)
> This is a markdown doc made by rysaio - the human maintainer of this repo

## 1. Some places to find ideas
1. github.com/simon-p-j-r/LLM4Pentest/blob/main/README_zh.md 
2. https://github.com/oritera/Cairn

## 2. Ideas 
> will quote above ## 1. as (q. )
1. Blackboard Architecture (q.2)

   - **借表示。** Evidence=Fact、pending Case Work Item=Intent、
     Attention/Memory=Hint、Case State=图。Postgres 仍是唯一写入。合 ADR 0001。
   - **多 agent 自选协作 = 用。** 发布任务→专精 agent 自选接不接→协作扩展取证能力
     (osquery/Wazuh/Zeek/EVTX),由 arXiv 2510.01285 验证。post-v1/Mastra 期;
     v1 单 worker loop,现在只是别把 planner 写死。限 read-only 取证,不触 Action Executor。
   - **但弃 Cairn 的具体机制:** 无中心纯 stigmergy 涌现、Dispatcher 唯一协议写入者、
     运行时凭空生成无角色 agent。协作要跑在你的框架里(Wake Gate 决定开不开工、
     Postgres 当真相源),不是 Cairn 那种无中心 + 无 Wake Gate 的版本。
   - **有界调查搜索。** 调查阶段像渗透,可借 fact-intent 机会主义搜索替代固定 playbook;
     但目标双向(证实 / 排除误报)且收敛,跑在三道闸门内。
   - **「无边界」只指 read/搜索层**(放手取证、扩展取证能力),不指动作。
     ∴ Policy Gate 不冗余:它本就是分级执行策略(低危自动放行/高危需确认/拒绝),
     非「凡动作必人批」。保留为确定性、可审计的单一闸口;权限分级在它内部,别打散。

2.  


## 3. Ideas deserve thinking
> will quote ## 2.  as (i. )

### 黑板 vs 工具平台:不是路线之争,是两层 (i.1)

- **两层不同的东西,别二选一:**
  - 工具平台(Claude Code / 微步 Flocks)= **能力面**:通用模型 + 一堆工具/接口。
    回答「agent 能用什么」。是地基,能力扩展靠它(加 adapter)。
  - 黑板(Cairn)= **协调面**:共享状态板,大家读/写。
    回答「多步推理怎么编排、多 agent 怎么不打架」。是叠加层。
  - 正解:**底座用工具平台,开放式多步任务的过程编排可选黑板。** 两者天然叠加
    (Claude Code 自己就是「工具平台外壳 + 内部 agentic loop」)。

- **黑板按任务开放程度选用,不是越多越好:**
  - 开放/路径未知/要搜索(调查、狩猎、溯源)→ 有用,黑板主场。
  - 流程基本固定(signal 归一化、合规检查、日报)→ 累赘,用流水线/状态机。
  - 多专精能力凑一起(osquery+网络+EDR)→ 有用 = 前述「自选协作」。
  - 它对泛化的提升来自「不写死路径」,不是架构本身;硬套固定流程会更难测/难停。

- **三种「扩展」来源不同:** 能力扩展←工具平台;协作扩展←黑板+自选;
  泛化←不写死流程(黑板帮一部分)+ 模型够强。


## the ideas and thoughts might work here 
> choose something above, applicable to this project.

### 1.
