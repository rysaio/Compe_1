## Agent skills

### Issue tracker

Issues are tracked as GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout. See `docs/agents/domain.md`.

### Git authorship

Agents should commit their own completed changes for traceability. Use the
agent's own commit author, for example `git commit --author="Codex
<codex@openai.com>"`, and do not add the human user as a co-author unless the
user explicitly requests it.

## Documentation authority

Durable project knowledge lives in `CONTEXT.md` and `docs/`. Treat
`.claude/artifacts/` as a tool workspace for generated intermediate artifacts,
not as the canonical project knowledge base. Promote aligned designs into
`docs/designs/`, accepted decisions into `docs/adr/`, and stable domain
language into `CONTEXT.md`.

## Project philosophy

This project builds a security operations harness, not a one-shot chatbot or a
fixed security workflow. Treat the model as the reasoning engine inside a
durable operating environment made of tools, task state, domain knowledge,
permissions, audit records, and human collaboration.

Use the Claude Code / Codex pattern as the north star: an agent loop that can
observe, plan, call tools, update task state, load focused skills, compress
context, delegate work, resume later, and operate inside explicit permission
boundaries.

For this product, do not design the agent as a single model call inside a
workflow step. Design the system so the security operations agent can keep
working over time: read signals, maintain cases and tasks, investigate through
tools, propose or execute allowed actions, explain decisions, and write an
auditable trail.

Keep detection and raw telemetry platforms as upstream capabilities from tools
such as Wazuh, Sysmon, EDR, SIEM, firewalls, or log platforms. This project owns
the operations harness around those signals: case handling, case work items,
agent jobs, action policy, explanation, escalation, audit, and operator
experience.

For v1, use a probe-first, Wazuh-compatible integration posture. The product
should work without requiring the user to already run Wazuh, Splunk, or an EDR,
by providing a small evidence probe kit for investigation. Do not let that probe
kit become a self-built SIEM/EDR: avoid detection engineering, correlation
engines, risk scoring, playbook designers, fleet telemetry platforms, or full
security data lakes. When an upstream platform already owns signals, cases,
automations, or response actions, integrate with that ownership rather than
duplicating it.

Model the product as aligned harness components, not as a linear workflow:
`Harness Service API`, `SOC Operator Agent`, `Evidence Probe Kit`,
`Signal Collectors`, `Evidence Tools`, `Operational Case`, `Case State`,
`Case Work Item`, `Agent Job`, `Evidence Protocol`, `Signal Intake`,
`Wake Gate`, `Policy Gate`, `Action Executors`, `Operator Attention Channel`,
`Operational Memory`, `Audit Trail`, and `Operator Workbench`.

Design API-first. The core product surface is the harness service API that lets
frontends, existing hospital or enterprise systems, and future integrations
create cases, submit signals, manage case work items, request approvals, read
evidence, and inspect audit history. Operator Workbench is an optional reference
interface built on that API, not the source of truth. Chat is only a control and
clarification channel, not the primary product shape.
