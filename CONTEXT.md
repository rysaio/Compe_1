# Security Operations Harness

This context defines the stable language for the security operations agentic
application. It is a glossary, not an implementation plan.

## Language

**SOC Operator Agent**:
The model-driven security operations actor that repeatedly reads operational
state, uses tools, proposes or performs allowed work, and records progress
inside the harness.
_Avoid_: Chatbot, assistant persona

**Security Operations Harness**:
The operating environment that lets a security operations agent observe signals,
use tools, maintain tasks, act within permissions, and leave an audit trail over
time.
_Avoid_: Security workflow bot, one-shot SOC chatbot

**Agent Loop**:
A repeated observe-plan-act-reflect cycle where the agent reads the current
security operations state, chooses useful next work, calls tools, updates task
state, and continues or sleeps until new work appears.
_Avoid_: Single model call, one-time analysis step

**Operational Case**:
A user-facing security operations work item formed from one or more alerts,
events, observations, or action results that need investigation, explanation,
response, or closure.
_Avoid_: Raw event, single alert, detection

**Case State**:
The current object set attached to an operational case, such as signals,
evidence, hypotheses, tasks, action proposals, attention requests, audit events,
and memory references.
_Avoid_: Case workflow stage, linear process state

**Signal Collectors**:
Upstream systems or adapters that provide security signals, such as Wazuh,
Sysmon, EDR, SIEM, firewall, or log-platform sources.
_Avoid_: In-house detection engine

**Evidence Tools**:
Tools that gather or enrich evidence for an operational case, such as asset,
host, process, IP, domain, vulnerability, allowlist, or historical-alert lookup.
_Avoid_: Action executor

**Task Ledger**:
The durable record of what the agent and human operators need to do, are doing,
have done, and are waiting on for each operational case.
_Avoid_: Workflow engine, hidden model memory, informal chat history

**Policy Gate**:
The deterministic permission and safety boundary that decides whether an agent
recommendation may become a real action, needs human confirmation, or must be
denied.
_Avoid_: Model-only permission check, implicit approval

**Action Executors**:
Controlled connectors that perform real-world security operations actions after
the policy gate allows them, such as blocking an IP, triggering a scan, creating
a ticket, or applying an endpoint control.
_Avoid_: Direct model action

**Operator Attention Channel**:
The structured channel where the agent asks a human operator for approval,
missing context, correction, or escalation when it reaches an information or
permission boundary.
_Avoid_: General chat window

**Operational Memory**:
Structured, auditable knowledge about the environment, assets, prior decisions,
false positives, approved patterns, and operating constraints that may inform
future cases.
_Avoid_: Free-form long-term model memory

**Audit Trail**:
The durable record of signals observed, evidence gathered, recommendations made,
policy decisions, human approvals, actions executed, and outcomes.
_Avoid_: Unstructured transcript

**Operator Workbench**:
The human-facing SOC operations interface that shows cases, case state, tasks,
evidence, action proposals, attention requests, explanations, and audit history.
_Avoid_: Chat-first UI
