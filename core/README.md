# @harness/core — Bare Agent Loop

Security operations agent harness core. Implements the **Agent Loop** (observe-plan-act-record) with a two-path approval boundary, typed tool set, and per-step Audit Trail writes.

## Architecture

```
runAgentLoop()
  │
  ├─ AUTOMATIC PATH (Evidence Tools)
  │    generateText + stopWhen:isLoopFinished()
  │    onStepFinish → AuditTrail.append(step_finished)
  │    Returns: { status: "completed" }
  │
  └─ HUMAN-APPROVAL PATH (Action Tools, needsApproval: true)
       generateText stops when SDK detects needsApproval tool
       Messages have tool-approval-request part
       Persists messages in RunStore
       Returns: { status: "awaiting_approval" }
         │
         └─ resumeAgentLoop()
              Appends tool-approval-response to messages
              Calls generateText() again → executes approved tool
              Returns: { status: "completed" }
```

## Ports (swap in Postgres later)

| Port | Adapter | Purpose |
|---|---|---|
| `AuditTrail` | `InMemoryAuditTrail` | Append-only run event log |
| `RunStore` | `InMemoryRunStore` | Run state (status + messages) |

## Quick start

```ts
import {
  runAgentLoop, resumeAgentLoop,
  InMemoryAuditTrail, InMemoryRunStore,
} from "@harness/core";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const provider = createOpenAICompatible({
  name: "openai-compatible",
  baseURL: process.env.OPENAI_BASE_URL!,
  apiKey: process.env.OPENAI_API_KEY!,
});
const model = provider(process.env.OPENAI_MODEL ?? "gpt-4o-mini");

const auditTrail = new InMemoryAuditTrail();
const runStore  = new InMemoryRunStore();

// Start a run
const result = await runAgentLoop({
  runId: "run-001",
  caseId: "case-001",
  prompt: "Investigate suspicious traffic from 10.0.0.1",
  model, auditTrail, runStore,
});

if (result.status === "awaiting_approval") {
  // Operator reviews and approves...
  const run = await runStore.get("run-001");
  const approvalEntry = (await auditTrail.listByRun("run-001"))
    .find(e => e.kind === "awaiting_approval");

  await resumeAgentLoop({
    runId: "run-001",
    approval: { toolCallId: approvalEntry.data.toolCallId, outcome: "approved" },
    model, auditTrail, runStore,
  });
}
```

## Tools

| Tool | Type | `needsApproval` | Description |
|---|---|---|---|
| `lookupAsset` | Evidence | — (automatic) | Look up a monitored asset by hostname |
| `lookupIp` | Evidence | — (automatic) | IP reputation lookup |
| `blockIp` | Action | `true` (human) | Block an IP via Action Executor |

## Environment variables

| Variable | Required | Default |
|---|---|---|
| `OPENAI_API_KEY` | Yes | — |
| `OPENAI_BASE_URL` | Yes | — |
| `OPENAI_MODEL` | No | `gpt-4o-mini` |

## Testing

```bash
# Unit tests only (no network):
npm test

# All tests including real provider:
OPENAI_API_KEY=... OPENAI_BASE_URL=... OPENAI_MODEL=... npm test
```

Unit tests use a `FakeTurn` script model — no network. Integration tests gate on env presence and skip cleanly when absent.

## Adding more tools

**Evidence Tool** (automatic):
```ts
export const myEvidenceTool = tool({
  description: "...",
  inputSchema: z.object({ ... }),
  execute: async (args) => { /* real probe */ },
  // needsApproval omitted → automatic
});
```

**Action Tool** (human approval):
```ts
export const myActionTool = tool({
  description: "...",
  inputSchema: z.object({ ... }),
  needsApproval: true,
  execute: async (args) => { /* real executor, post-approval */ },
});
```

Add the tool name to `ACTION_TOOL_NAMES` in `agent-loop.ts`, and add it to `evidenceTools` or `actionTools` in `tools.ts`.

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
