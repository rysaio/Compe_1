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

**Harness Service API**:
The API-first service surface for creating cases, submitting signals, reading
evidence, managing case work items, requesting or recording approvals, starting
agent work, and reading audit history. User interfaces and external systems
consume this API; they are not the source of truth.
_Avoid_: UI-owned business state, dashboard-only product, chat-only control

**Agent Loop**:
An observe-plan-act-record cycle that runs bounded agent work over an
Operational Case or Case Work Item, then stops with a recorded outcome. A new
run is triggered by a new agent job, not by open-ended polling.
_Avoid_: Single model call, one-time analysis step, unbounded polling loop

**Operational Case**:
A user-facing security operations work item formed from one or more alerts,
events, observations, or action results that need investigation, explanation,
response, or closure.
_Avoid_: Raw event, single alert, detection

**Case State**:
The current object set attached to an operational case: evidence, case work
items, and audit trail entries. Action proposals are a type of case work item;
approval requests are case work items in awaiting_approval state; execution
records are audit trail events.
_Avoid_: Case workflow stage, linear process state, hidden model memory

**Case Work Item**:
A security work item inside an operational case that advances the case's
investigation, judgment, response, or review. Business states: pending,
in_progress, completed, failed, awaiting_approval. awaiting_approval is a
business state, not a scheduling state; when approval completes, the system
creates or releases a corresponding agent job. Action proposals are a kind of
case work item. Case work items must serve the operational case's security
objective; they must not cover general asset maintenance, contact backfill,
generic report writing, project management, or unrelated IT tickets.
_Avoid_: Queue message, scheduler task, hidden model plan, general IT work item

**Agent Job**:
A bounded runtime work unit that drives the SOC Operator Agent or agent tool
chain to perform security operations work on an Operational Case or Case Work
Item. It does not include runtime maintenance tasks, queue cleanup, adapter
health checks, or deterministic signal intake.
_Avoid_: Runtime maintenance task, scheduler housekeeping, infrastructure job

**Evidence Protocol**:
A domain rule set that defines the minimum evidence, known gaps, and confidence
constraints required before the agent may present a conclusion, recommend an
action, or request execution. It does not prescribe a fixed investigation
order. When evidence conditions are not met, the agent may still produce
output, but must change the output type — flagging gaps and lowering confidence
rather than halting. Evidence Protocol applies to case work items that support
security conclusions or action recommendations; evidence-gathering or review
work items are primarily constrained by the case objective and tool
permissions, not necessarily by Evidence Protocol.
_Avoid_: Fixed workflow, playbook, mandatory step sequence

**Signal Intake**:
The deterministic processing of incoming security signals before the wake gate:
parsing, field normalization, deduplication, and merging into existing cases.
Signal intake does not call the model.
_Avoid_: AI-driven triage, agent-based signal classification

**Upstream Security Platform**:
An external security product that owns telemetry ingestion, detections, native
alerts, native cases, or native automations. The harness consumes, explains,
and coordinates around these systems instead of replacing them.
_Avoid_: In-house SIEM, in-house SOAR, duplicate detection platform

**Probe-first, Wazuh-compatible**:
The v1 integration posture: the harness can gather basic investigation evidence
through built-in probes without requiring a deployed SIEM/SOAR, while remaining
compatible with Wazuh and other upstream security platforms when they exist.
_Avoid_: Wazuh-only AI panel, self-built SIEM/EDR

**Signal Collectors**:
Upstream systems or adapters that provide security signals, such as Wazuh,
Sysmon, EDR, SIEM, firewall, or log-platform sources.
_Avoid_: In-house detection engine

**Evidence Probe Kit**:
Built-in, lightweight evidence-gathering tools the agent can call during an
investigation, such as osquery, event-log readers, Zeek or NetFlow importers,
and artifact readers. It provides queryable evidence; it is not a continuous
telemetry, detection, or endpoint-protection platform.
_Avoid_: Self-built EDR, full collector platform, detection engine

**Evidence Tools**:
Tools that gather or enrich evidence for an operational case, such as asset,
host, process, IP, domain, vulnerability, allowlist, or historical-alert lookup.
_Avoid_: Action executor

**Wake Gate**:
The deterministic gate that decides whether a signal, schedule, or operator
event should consume agent runtime and human attention. It controls run cost and
attention pressure; it is not a threat detection or correlation engine.
_Avoid_: SIEM correlation, risk-based alerting, detection rule

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
An optional human-facing SOC operations interface built on top of the Harness
Service API. It shows cases, case state, case work items (including action
proposals), evidence, attention requests, explanations, and audit history, but
does not define the core product boundary.
_Avoid_: Source of truth, chat-first UI, CLI-first security tool
