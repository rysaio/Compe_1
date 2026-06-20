# @harness/core — Bare Agent Loop

Security operations agent harness core. Implements the **Agent Loop** (observe-plan-act-record) with a two-path approval boundary, typed tool set, and per-step Audit Trail writes.

## Architecture

```
runAgentLoop()
  │   Audit Trail writes (both paths):
  │     onStepFinish                  → step_finished + tool_called (model intent)
  │     experimental_onToolCallFinish → tool_result per EXECUTION — fires for
  │         automatic tools AND approved tools executed on resume
  │
  ├─ AUTOMATIC PATH (tools without needsApproval)
  │    generateText + stopWhen:isLoopFinished()
  │    SDK runs the tools unattended; each execution → tool_result
  │    Returns: { status: "completed" }
  │
  └─ HUMAN-APPROVAL PATH (tools with needsApproval: true)
       generateText stops when SDK detects needsApproval tool
       Messages have tool-approval-request part
       Persists messages in RunStore
       Returns: { status: "awaiting_approval" }
         │
         └─ resumeAgentLoop()
              Appends tool-approval-response to messages
              Calls generateText() again → SDK executes approved tool
              onToolCallFinish records its tool_result (the action executed)
              Returns: { status: "completed" }
```

## Ports (swap in Postgres later)

| Port | Adapter | Purpose |
|---|---|---|
| `AuditTrail` | `InMemoryAuditTrail` | Append-only run event log |
| `RunStore` | `InMemoryRunStore` | Run state (status + messages) |
| `PreconditionMarkerStore` | `InMemoryPreconditionMarkerStore` | Current precondition markers scoped to a case |

## Quick start

```ts
import {
  runAgentLoop, resumeAgentLoop,
  InMemoryAuditTrail, InMemoryRunStore, InMemoryPreconditionMarkerStore,
} from "@harness/core";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const provider = createOpenAICompatible({
  name: "openai-compatible",
  baseURL: process.env.OPENAI_BASE_URL!,
  apiKey: process.env.OPENAI_API_KEY!,
});
const model = provider(process.env.OPENAI_MODEL ?? "qwen3.6-plus");

const auditTrail = new InMemoryAuditTrail();
const runStore  = new InMemoryRunStore();
const markerStore = new InMemoryPreconditionMarkerStore();

// Start a run
const result = await runAgentLoop({
  runId: "run-001",
  caseId: "case-001",
  prompt: "Investigate suspicious traffic from 10.0.0.1",
  model, auditTrail, runStore, markerStore,
});

if (result.status === "awaiting_approval") {
  // Operator reviews and approves...
  const run = await runStore.get("run-001");
  const approvalEntry = (await auditTrail.listByRun("run-001"))
    .find(e => e.kind === "awaiting_approval");

  await resumeAgentLoop({
    runId: "run-001",
    approval: { toolCallId: approvalEntry.data.toolCallId, outcome: "approved" },
    model, auditTrail, runStore, markerStore,
  });
}
```

## Tools

A flat, unordered set of peers (`allTools`). The only structural distinction is
per-tool `needsApproval`; there is no category hierarchy. Classic generic tools
exercise the general agent layer; the security stubs are peers alongside them.

| Tool | `needsApproval` | Description |
|---|---|---|
| `calculator` | — (automatic) | Evaluate a basic arithmetic operation |
| `getWeather` | — (automatic) | Current weather for a city (stub) |
| `sendEmail` | `true` (human) | Send an email (post-approval) |
| `lookupAsset` | — (automatic) | Look up a monitored asset by hostname |
| `lookupIp` | — (automatic) | IP reputation lookup |
| `blockIp` | `true` (human) | Block an IP on the firewall (post-approval) |

## Environment variables

| Variable | Required | Default |
|---|---|---|
| `OPENAI_API_KEY` | Yes | — |
| `OPENAI_BASE_URL` | Yes | — |
| `OPENAI_MODEL` | No | `qwen3.6-plus` (the DashScope/Qwen model this repo targets) |

## Testing

```bash
# Unit tests only (no network):
npm test

# All tests including real provider:
OPENAI_API_KEY=... OPENAI_BASE_URL=... OPENAI_MODEL=... npm test
```

Unit tests use a `FakeTurn` script model — no network. Integration tests gate on env presence and skip cleanly when absent.

`vitest` transpiles with esbuild and does **not** type-check, so run the type checker separately before committing:

```bash
npm run typecheck   # tsc --noEmit
```

## Adding more tools

**Automatic tool** (runs unattended):
```ts
export const myTool = tool({
  description: "...",
  inputSchema: z.object({ ... }),
  execute: async (args) => { /* ... */ },
  // needsApproval omitted → automatic
});
```

**Approval tool** (pauses for a human):
```ts
export const myActionTool = tool({
  description: "...",
  inputSchema: z.object({ ... }),
  needsApproval: true,
  execute: async (args) => { /* runs only post-approval */ },
});
```

Add it to the flat `allTools` set in `tools.ts` — that's the only step. The approval path is driven entirely by the tool's `needsApproval` flag: the SDK pauses (emits `tool-approval-request`) for `needsApproval: true` tools, so `agent-loop.ts` needs no per-tool list.

## Replacing adapters

```ts
// Postgres AuditTrail adapter (future):
class PostgresAuditTrail implements AuditTrail {
  async append(entry) { /* INSERT INTO audit_trail */ }
  async listByRun(runId) { /* SELECT * WHERE run_id = ... */ }
}
```

The core is adapter-agnostic — swap without touching `agent-loop.ts`.

## Scope and deferred items

**In scope (this package):**
- Agent Loop (both paths), Audit Trail, RunStore, Evidence/Action tool stubs

**Deferred per spec:**
- Postgres adapter, pg-boss worker loop, Policy Gate signing, Evidence Protocol rules, Wake Gate, Case Work Item/Job wrapping
