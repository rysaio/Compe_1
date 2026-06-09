# Security Systems and Agent Integration Research

Date: 2026-06-09

This report summarizes common security-system shapes, how operators use them,
which parts are suitable for agent tool use, and how the Security Operations
Harness should safely access them.

## Executive Summary

The product should keep the current boundary:

```text
Probe-first, Wazuh-compatible
```

This means:

- The product can run without requiring the customer to already deploy Wazuh,
  Splunk, or an EDR.
- The product includes a small Evidence Probe Kit for investigation-time
  evidence gathering.
- The product does not become a SIEM, SOAR, EDR, NDR, or fleet telemetry
  platform.
- When Wazuh, Splunk, Defender, Velociraptor, firewalls, or other security
  platforms exist, the harness accesses them through narrow adapters.

The agent should never call complex security devices directly. The safe pattern
is:

```text
Agent intent
-> typed tool adapter
-> permission scope
-> deterministic validation
-> external system API / local probe
-> normalized evidence
-> case state + audit trail
```

For v1, the most useful tool surface is:

```text
Evidence Probe Kit:
- osquery probe
- Windows Event Log / Sysmon importer
- Linux auth/system log importer
- Zeek or NetFlow importer
- Suricata EVE JSON importer, optional
- Wazuh read adapter, optional but supported
- threat intelligence and ATT&CK enrichment, controlled and cached
```

Action execution should be narrower than evidence gathering:

```text
Default v1 action posture:
- read and investigate broadly
- propose response actions
- execute only low-risk, preconfigured, policy-gated actions
- require human approval for endpoint isolation, account disablement, blocking,
  quarantine, or destructive actions
```

## System Shapes

### 1. Wazuh-like SIEM/XDR Platform

Wazuh is a security platform made of deployed agents, a server/manager, an
indexer, and a dashboard. It covers capabilities such as log analysis, file
integrity monitoring, vulnerability detection, configuration assessment,
security monitoring, and active response.

Operator usage:

- Deploy Wazuh agents to endpoints.
- Collect endpoint and security logs.
- View alerts and dashboards.
- Configure rules, decoders, vulnerability checks, file monitoring, and active
  response.

Agent-suitable access:

- Read agents, alerts, vulnerabilities, inventory, rule metadata, and alert
  history through the Wazuh server/indexer APIs.
- Use Wazuh as an upstream signal source and evidence source.
- Treat Wazuh Active Response as a controlled action channel, not as free-form
  agent execution.

Risk boundary:

- Do not rebuild Wazuh rules, decoders, indexer, dashboard, or active response
  engine.
- Do not let model output become Wazuh config without review.
- Do not use Wazuh action paths unless Policy Gate approves target, action type,
  timeout, and rollback expectations.

Useful references:

- [Wazuh architecture](https://documentation.wazuh.com/current/getting-started/architecture.html)
- [Wazuh server API](https://documentation.wazuh.com/current/user-manual/api/index.html)
- [Wazuh capabilities](https://documentation.wazuh.com/current/user-manual/capabilities/index.html)
- [Wazuh Active Response](https://documentation.wazuh.com/current/user-manual/capabilities/active-response/index.html)
- [Wazuh osquery module](https://documentation.wazuh.com/current/user-manual/capabilities/system-inventory/osquery.html)

### 2. Splunk ES / Splunk SOAR-like Enterprise Platform

Splunk Enterprise Security already has notable events, incident review,
investigations, adaptive response, and risk-based workflows. Splunk SOAR adds
case management, artifacts, apps/actions, playbooks, and a REST API.

Operator usage:

- Ingest large volumes of logs.
- Search with SPL.
- Use notable events and incident review for alert triage.
- Run investigations.
- Use SOAR playbooks and apps to automate response.

Agent-suitable access:

- Read notable events, searches, saved searches, case containers, artifacts, and
  playbook results through Splunk APIs.
- Add comments, summaries, or recommended tasks to an existing case if the
  customer already uses Splunk as the case source of truth.
- Trigger SOAR actions only through pre-approved playbooks or action wrappers.

Risk boundary:

- Do not compete with Splunk's search language, data lake, notable-event model,
  ES dashboards, or SOAR playbook designer.
- Do not make Splunk a v1 prerequisite because that would make the product an AI
  panel for an existing platform.

Useful references:

- [Splunk Enterprise Security Incident Review](https://help.splunk.com/en/splunk-enterprise-security-7/user-guide/7.2/incident-review/take-action-on-a-notable-on-incident-review-in-splunk-enterprise-security)
- [Splunk Enterprise Security investigations](https://help.splunk.com/splunk-enterprise-security-7/user-guide/7.2/investigations/investigations-in-splunk-enterprise-security)
- [Splunk SOAR REST API](https://help.splunk.com/en/splunk-soar/soar-cloud/rest-api-reference/using-the-splunk-soar-rest-api/using-the-rest-api-reference-for-splunk-soar-cloud)

### 3. EDR/XDR Platform

EDR platforms such as Microsoft Defender for Endpoint expose alerts, devices,
device risk, incident links, evidence, and high-impact response actions such as
device isolation and release from isolation.

Operator usage:

- Review alerts and incidents.
- Inspect affected devices and evidence.
- Run investigation or response actions.
- Isolate or release devices.

Agent-suitable access:

- Read alerts, device inventory, related device information, and related
  evidence.
- Map EDR alert/device IDs to an Operational Case.
- Propose high-impact actions, but route execution through Policy Gate and human
  confirmation.

Risk boundary:

- EDR isolation, quarantine, live response, and account actions are high-impact.
- The model should never choose these directly.
- Use least-privilege credentials, tenant-level rate limits, and explicit audit
  reasons.

Useful references:

- [Microsoft Defender for Endpoint alerts API](https://learn.microsoft.com/en-us/defender-endpoint/api/get-alerts)
- [Microsoft Defender for Endpoint machines API](https://learn.microsoft.com/en-us/defender-endpoint/api/get-machines)
- [Microsoft Defender for Endpoint isolate machine API](https://learn.microsoft.com/en-us/defender-endpoint/api/isolate-machine)
- [Microsoft Defender for Endpoint release isolation API](https://learn.microsoft.com/en-us/defender-endpoint/api/unisolate-machine)

### 4. osquery / Fleet-like Endpoint Probe

osquery exposes operating-system state through SQL tables. It can run as an
interactive shell (`osqueryi`) or as a daemon (`osqueryd`) with scheduled
queries, packs, logging, and remote configuration. Fleet is a common management
layer for osquery with a REST API.

Operator usage:

- Query processes, users, groups, services, listening ports, packages, browser
  extensions, startup items, file metadata, routes, and other host facts.
- Use scheduled queries or packs to collect repeatable evidence.
- Use a management layer for distributed query and policy reporting.

Agent-suitable access:

- Excellent for Evidence Probe Kit.
- The agent should call predefined query templates, not arbitrary SQL from model
  output.
- Results should be normalized into evidence rows and summarized before entering
  model context.

Risk boundary:

- osquery is not an EDR by itself.
- Some tables require elevated permissions or have performance implications.
- Event-based tables and high-frequency schedules can create data volume and
  performance risk.

Useful references:

- [osquery shell](https://osquery.readthedocs.io/en/stable/introduction/using-osqueryi/)
- [osquery deployment configuration](https://osquery.readthedocs.io/en/stable/deployment/configuration/)
- [osquery remote settings](https://osquery.readthedocs.io/en/stable/deployment/remote/)
- [Fleet REST API](https://fleetdm.com/docs/rest-api/rest-api)

### 5. Sysmon / Windows Event Collection

Sysmon is a Windows service and driver that logs detailed system activity to
Windows Event Log, including process creation, network connections, file
creation, registry activity, DNS queries, and more depending on configuration.
Windows Event Collector can centralize events through subscriptions.

Operator usage:

- Install Sysmon with a configuration file.
- Collect events through Windows Event Collection, SIEM agents, or local export.
- Investigate process trees, network connections, file writes, registry
  persistence, and credential-access indicators.

Agent-suitable access:

- Read local EVTX exports or centralized event streams.
- Parse selected Sysmon event IDs into normalized evidence.
- Join Sysmon events with osquery host facts.

Risk boundary:

- Sysmon does not analyze events by itself.
- Verbose event types can generate large volumes.
- The harness should import and explain selected evidence, not own Windows event
  collection at enterprise scale in v1.

Useful references:

- [Microsoft Sysmon](https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon)
- [Windows Event Collector](https://learn.microsoft.com/en-us/windows/win32/wec/windows-event-collector)

### 6. Zeek / NetFlow / Suricata Network Evidence

Zeek is a network security monitor that turns network traffic into structured
logs such as connection, DNS, HTTP, SSL/TLS, files, and notices. Suricata is an
IDS/IPS/NSM engine that can output alerts and metadata through EVE JSON. NetFlow
or firewall logs provide lower-detail network-flow evidence.

Operator usage:

- Run a network sensor or process a PCAP.
- Review structured network logs and alerts.
- Correlate source/destination IPs, domains, ports, protocols, and timestamps.

Agent-suitable access:

- Import Zeek logs, Suricata EVE JSON, NetFlow exports, or firewall logs.
- Use them as evidence for timeline and entity relationship building.
- Support PCAP processing only by calling Zeek/Suricata as external tools, not
  by writing a custom packet parser.

Risk boundary:

- Live packet capture is operationally sensitive and can collect regulated data.
- Network detection tuning is not v1 product ownership.
- v1 should prefer import mode over always-on sensor mode.

Useful references:

- [Zeek overview](https://docs.zeek.org/en/current/about/index.html)
- [Zeek common logs](https://docs.zeek.org/en/current/reference/logs/index.html)
- [Suricata overview](https://docs.suricata.io/en/latest/what-is-suricata.html)
- [Suricata EVE JSON output](https://docs.suricata.io/en/latest/output/eve/eve-json-output.html)

### 7. Velociraptor-like DFIR Platform

Velociraptor is a DFIR platform built around endpoint clients, VQL queries,
artifact collections, flows, and hunts. It exposes a powerful gRPC API for
automation, and its REST API is not the recommended stable automation surface.

Operator usage:

- Deploy clients.
- Collect artifacts from endpoints.
- Run hunts across endpoint groups.
- Inspect uploaded files and result tables.
- Use quarantine and other response capabilities when appropriate.

Agent-suitable access:

- Use as an advanced external adapter, not v1's built-in probe layer.
- Trigger only predefined artifact collections.
- Read flow/hunt results as evidence.
- Avoid arbitrary VQL from model output.

Risk boundary:

- Velociraptor is powerful enough to become an incident-response platform by
  itself.
- Its API can run broad endpoint queries and schedule hunts, so agent access must
  be constrained by templates, roles, labels, and approval.

Useful references:

- [Velociraptor overview](https://docs.velociraptor.app/docs/overview/)
- [Velociraptor artifact collections](https://docs.velociraptor.app/docs/clients/artifacts/)
- [Velociraptor hunts](https://docs.velociraptor.app/docs/hunting/)
- [Velociraptor server API](https://docs.velociraptor.app/docs/server_automation/server_api/)

## Agent Access Patterns

### Pattern A: Local Probe Adapter

Use when the product needs to work without an external security platform.

Examples:

- Run an approved osquery template against a local or managed endpoint.
- Import an EVTX file.
- Parse a Zeek log directory.
- Parse Suricata EVE JSON.

Adapter contract:

```text
input: target, query_template_id, time_window, parameters
output: normalized evidence rows, source references, warnings
controls: allowlist templates, timeout, max rows, redaction, audit
```

Best fit for v1:

- Yes.

### Pattern B: External Platform Read Adapter

Use when a customer already has Wazuh, Splunk, Defender, EDR, firewall, or SIEM.

Examples:

- Pull Wazuh alerts for an IP or host.
- Pull Defender alerts related to a device.
- Pull Splunk notable events for a time window.
- Pull firewall logs for a source IP.

Adapter contract:

```text
input: external_system_id, entity, time_window, query_template_id
output: normalized alerts, entities, evidence, external links
controls: read-only credentials, pagination, rate limits, cached results, audit
```

Best fit for v1:

- Wazuh read adapter should be the first external adapter.
- Others can share the same adapter shape later.

### Pattern C: External Platform Action Adapter

Use only when execution is explicitly needed and the action is controlled.

Examples:

- Ask Wazuh/SOAR to run a preconfigured response action.
- Ask Defender to isolate or release a device.
- Ask firewall or identity provider to block an IP or disable an account.

Adapter contract:

```text
input: action_type, target, duration, reason, case_id, approval_id
output: action_id, accepted/rejected, external status, rollback hint
controls: Policy Gate, human approval, allowlist actions, scoped credentials,
          rollback path, audit
```

Best fit for v1:

- Include the interface and one low-risk executor.
- Keep destructive or broad actions in recommend-only mode until policy and
  rollback are tested.

### Pattern D: Import Adapter

Use when the customer cannot grant live API access.

Examples:

- Upload Wazuh alert export.
- Upload EVTX.
- Upload Zeek logs.
- Upload firewall CSV.
- Upload EDR case export.

Adapter contract:

```text
input: file, declared_source_type, time_zone, parser_options
output: normalized evidence, parsing warnings, provenance record
controls: file size limit, malware-safe handling, schema validation, audit
```

Best fit for v1:

- Yes. This is important for hospitals and small enterprises that cannot quickly
  grant broad API access.

## V1 Recommended Tool Matrix

| Tool area | V1 posture | Why |
|---|---|---|
| osquery | Build first | Best endpoint evidence probe with structured SQL-style output |
| EVTX / Sysmon import | Build first | Windows evidence is common in hospitals and small enterprises |
| Linux auth/system logs | Build first | Cheap, useful, no platform dependency |
| Zeek log import | Build first or second | Good network evidence without writing a packet parser |
| NetFlow/firewall log import | Build first or second | Common in existing network gear |
| Suricata EVE JSON import | Optional v1 | Useful if customer has IDS logs, but not required |
| Wazuh read adapter | Build first external adapter | Common open-source security platform, compatible with product direction |
| Splunk read adapter | Defer | Mature platform, more likely enterprise/post-v1 |
| Defender/EDR read adapter | Defer unless pilot needs it | Valuable but credentialing and permissions are sensitive |
| Velociraptor adapter | Defer | Powerful DFIR platform, high blast radius |
| Active response / isolation | Minimal and gated | Proves execution, but must avoid unsafe automation |
| SOAR playbooks | Defer | Avoid becoming a SOAR designer |

## Proposed V1 Integration Architecture

```text
Operator Workbench
  -> Operational Case
  -> Agent Run
  -> Tool Registry
       -> Evidence Probe Kit
            -> osquery template runner
            -> EVTX/Sysmon parser
            -> Linux log parser
            -> Zeek/NetFlow importer
            -> Suricata EVE importer
       -> External Platform Adapters
            -> Wazuh read adapter
            -> Wazuh action adapter, gated and optional
            -> future Splunk/EDR/Velociraptor adapters
       -> Knowledge Tools
            -> ATT&CK lookup
            -> threat-intel lookup
            -> local allowlist and asset context
  -> Wake Gate
  -> Policy Gate
  -> Audit Trail
```

## Security and Governance Requirements

Agent integration must follow these rules:

- No raw model-to-device API access.
- No arbitrary shell, SQL, SPL, VQL, or Wazuh config emitted by the model.
- All tool calls use typed templates with bounded parameters.
- All external credentials are least-privilege and scoped per tenant/source.
- Read adapters and action adapters are separated.
- Action adapters require Policy Gate before execution.
- High-impact actions require human approval by default.
- Every tool call writes an audit event with input summary, target, result
  summary, source reference, and error state.
- Large logs and evidence stay outside model context; the model sees compact
  excerpts, summaries, and links to evidence records.
- Evidence provenance is first-class: source system, collection time, parser
  version, query template, and case link.

## Product Boundary

The product should own:

- case-centric investigation state
- agent-run traces
- case work items (business-level work tracking)
- agent jobs (runtime-level execution scheduling)
- evidence normalization
- explanation for non-specialist operators
- policy-gated action proposals
- audit and reporting
- operational memory about local environment, exceptions, assets, and prior
  decisions

The product should not own:

- SIEM-scale log indexing
- detection rule engineering as a product category
- endpoint protection or anti-malware
- continuous fleet telemetry management
- SOAR playbook designer
- raw packet capture platform
- broad automated containment

## Recommended Next Design Decisions

1. Decide the first endpoint target: Windows-first, Linux-first, or both.
   Recommendation: Windows-first plus Linux log import, because many hospital
   and SME environments are Windows-heavy.

2. Decide the first action executor.
   Recommendation: start with ticket/task creation plus one reversible,
   preconfigured response action that requires human approval.

3. Decide whether v1 includes live endpoint querying or import-only mode.
   Recommendation: support import-only mode and local osquery template execution
   first; postpone fleet-wide distributed query management.

4. Decide the normalized evidence schema.
   Recommendation: define a small common model around entity, observation,
   source, timestamp, confidence, and provenance.

