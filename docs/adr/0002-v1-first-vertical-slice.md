# V1 first vertical slice: suspicious shell execution on server hosts

The harness targets three asset dimensions — server hosts, endpoint
workstations, and internal-network lateral movement. For the first vertical
slice we deliberately pick **one**: suspicious shell execution on Linux server
hosts, signalled by Wazuh over auditd `execve` events (reverse shells,
download-and-execute, encoded one-liners, and web-process-spawned shells). The
slice runs the full chain end-to-end — Signal Intake → Wake Gate → Operational
Case → Agent Run (model insertion points B and C) → Policy Gate → Operator
Attention Channel → Action Executor → Audit Trail — through one Evidence Protocol
table whose required evidence is concrete and single-host (parent-process chain,
decoded command line, outbound connections, executing user/privilege).

## Considered Options

- **Server-host suspicious shell (chosen).** Single-host evidence closes inside
  one Agent Run; the Evidence Protocol table is small and fully writable; it
  feeds both model insertion points; it matches the emphasis on server and
  internal-network security operations; the demo has a complete narrative.
- **Endpoint Windows PowerShell.** Equivalent shape in Windows vocabulary
  (Sysmon EID 1/3, Word-spawned PowerShell). Valid, but the renewed product
  emphasis is servers, not workstations. Kept in the positioning, not the slice.
- **Internal-network lateral movement.** Rejected for v1. Its evidence is
  cross-host, cross-time correlation that no single-host run can see; it presumes
  multi-source aggregation and entity (host/account/IP) alignment as
  prerequisites. It is v2+ capability and listed as a positioning direction only.

## Consequences

- The positioning stays three-dimensional (servers, endpoints, lateral
  movement); only the first slice is narrowed. Slices are added later, not the
  scope cut from the vision.
- Evidence Protocol is parameterised per case type (see CONTEXT.md), so a second
  asset dimension means a new evidence table, not an architecture change.
- v1 needs a Linux probe set (process-tree reader, `ss`/connection lookup,
  base64/obfuscation decoder, IP-reputation lookup) and a recommended auditd
  ruleset as a deployment prerequisite — open question, see grilling handoff.
