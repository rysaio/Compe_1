## Agent skills

### Issue tracker

Issues are tracked as GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout. See `docs/agents/domain.md`.

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

Keep detection and raw telemetry as upstream capabilities from tools such as
Wazuh, Sysmon, EDR, SIEM, firewalls, or log platforms. This project owns the
operations harness around those signals: case handling, task ledger, action
policy, explanation, escalation, audit, and operator experience.

Model the product as aligned harness components, not as a linear workflow:
`SOC Operator Agent`, `Signal Collectors`, `Evidence Tools`, `Operational Case`,
`Case State`, `Task Ledger`, `Policy Gate`, `Action Executors`,
`Operator Attention Channel`, `Operational Memory`, `Audit Trail`, and
`Operator Workbench`.

When designing features, keep the product effect centered on a working SOC
system. The user experience should surface operational cases, evidence, tasks,
attention requests, action proposals, explanations, and audit history; chat is
only a control and clarification channel, not the primary product shape.
