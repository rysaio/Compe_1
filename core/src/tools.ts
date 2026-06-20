/**
 * Tool set for the Agent Loop.
 *
 * The core is a GENERAL agent loop (ADR 0004): tools are a flat, unordered set
 * of peers. There is no category hierarchy — the only structural distinction is
 * per-tool `needsApproval`:
 *   - needsApproval omitted → automatic (the SDK runs it unattended)
 *   - needsApproval: true   → the SDK pauses (emits tool-approval-request) and
 *     `execute` runs only after a human approves
 *
 * This file ships both domain-neutral "classic" tools (used to exercise the
 * agent layer) and a few security-operations stubs, all as peers. Real probes /
 * executors plug into the `execute` bodies later.
 *
 * Uses inputSchema (Vercel AI SDK v6 name — NOT parameters).
 * Does NOT use dynamicTool() — v6 lacks needsApproval there (#11434).
 *
 * Precondition Gating (ADR 0005):
 *   `wrapAllTools()` wraps every tool's execute with a precondition check
 *   driven by the Precondition Table. Unmet preconditions return structured
 *   self-correction guidance instead of executing. The Policy Gate is one row
 *   in the table: an `approved:<toolName>` marker written when a human
 *   approves an action.
 */
import { tool, type Tool } from "ai";
import { z } from "zod";
import type { PreconditionTable } from "./precondition.js";
import { evaluate, generateGuidance } from "./precondition.js";
import type { PreconditionMarkerStore } from "./precondition-marker-store.js";

// ─── Classic generic tools (domain-neutral) ──────────────────────────────────

/** Evaluate a basic arithmetic operation. Automatic — no approval. */
export const calculatorTool = tool({
  description: "Evaluate a basic arithmetic operation on two numbers.",
  inputSchema: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    switch (operation) {
      case "add":
        return { result: a + b };
      case "subtract":
        return { result: a - b };
      case "multiply":
        return { result: a * b };
      case "divide":
        return b === 0
          ? { result: null, error: "division by zero" }
          : { result: a / b };
    }
  },
});

/** Look up the current weather for a city. Automatic — no approval. */
export const getWeatherTool = tool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async ({ city }) => {
    // Stub — a real weather API plugs in here.
    return { city, tempC: 21, conditions: "clear", note: "stub" };
  },
});

/**
 * Send an email. needsApproval: true → the harness pauses for human approval
 * before `execute` runs (a classic side-effecting action tool).
 */
export const sendEmailTool = tool({
  description: "Send an email to a recipient. Requires human approval.",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body"),
  }),
  needsApproval: true,
  execute: async ({ to, subject }) => {
    // Stub — a real mail transport plugs in here, post-approval.
    return { sent: true, to, subject };
  },
});

// ─── Security-operations stubs (peers of the classic tools) ───────────────────

/** Look up a monitored asset by hostname. Automatic — no approval. */
export const lookupAssetTool = tool({
  description: "Look up a monitored asset by hostname to gather evidence.",
  inputSchema: z.object({
    hostname: z.string().describe("Hostname of the monitored asset"),
  }),
  execute: async ({ hostname }) => {
    // Stub implementation — real probe kit plugs in here
    return {
      hostname,
      status: "online",
      os: "linux",
      tags: ["server"],
      note: "stub evidence",
    };
  },
});

/** Look up IP reputation and geolocation. Automatic — no approval. */
export const lookupIpTool = tool({
  description: "Look up IP address reputation and geolocation for evidence.",
  inputSchema: z.object({
    ip: z.string().describe("IP address to look up"),
  }),
  execute: async ({ ip }) => {
    return {
      ip,
      reputation: "unknown",
      country: "US",
      note: "stub evidence",
    };
  },
});

/**
 * Block an IP address on the perimeter firewall. needsApproval: true → the
 * harness pauses for human approval before `execute` runs.
 */
export const blockIpTool = tool({
  description:
    "Block an IP address on the perimeter firewall. Requires human approval.",
  inputSchema: z.object({
    ip: z.string().describe("IP address to block"),
    reason: z.string().describe("Reason for blocking"),
  }),
  needsApproval: true,
  execute: async ({ ip, reason }) => {
    // Stub — real Action Executor plugs in here, post-approval.
    return { blocked: ip, reason, executedAt: new Date().toISOString() };
  },
});

// ─── Flat tool set exposed to the model ───────────────────────────────────────

/** All tools as a flat, unordered set of peers. */
export const allTools = {
  calculator: calculatorTool,
  getWeather: getWeatherTool,
  sendEmail: sendEmailTool,
  lookupAsset: lookupAssetTool,
  lookupIp: lookupIpTool,
  blockIp: blockIpTool,
} as const;

export type AllTools = typeof allTools;

// ─── Precondition Table (config-as-data) ───────────────────────────────────────

/**
 * The default Precondition Table.
 *
 * Encodes real dependencies and safety conditions only (ADR 0003 / ADR 0005).
 * Never encodes investigation order among independent Evidence Tools.
 *
 * Current entries:
 *   - Action tools require an `approved:<toolName>` marker (Policy Gate).
 *   - Evidence tools have no preconditions (called anytime).
 *
 * Adding/removing a precondition is a table edit — no interface code changes.
 */
export const DEFAULT_PRECONDITION_TABLE: PreconditionTable = {
  blockIp: {
    rule: { allOf: ["approved:blockIp"] },
  },
  sendEmail: {
    rule: { allOf: ["approved:sendEmail"] },
  },
};

// ─── Execute wrapper ───────────────────────────────────────────────────────────

/**
 * Wraps every tool's `execute` with a precondition check driven by the
 * Precondition Table.
 *
 * Before the real `execute` runs:
 *   1. Look up the interface's precondition rule in the table.
 *   2. Evaluate the rule against the current marker set for the case.
 *   3. Unmet → return structured PreconditionUnmetGuidance (do NOT execute).
 *   4. Met   → execute; on success, write `called:<interfaceId>` marker.
 *
 * Tools without a table entry run with no precondition check (passthrough).
 *
 * One wrapper covers all tools — zero per-tool wiring (ADR 0005).
 */
export function wrapAllTools(
  tools: Record<string, Tool>,
  table: PreconditionTable,
  markerStore: PreconditionMarkerStore,
  caseId: string
): Record<string, Tool> {
  const wrapped: Record<string, Tool> = {};
  for (const [name, toolDef] of Object.entries(tools)) {
    wrapped[name] = wrapTool(name, toolDef, table, markerStore, caseId);
  }
  return wrapped;
}

function wrapTool(
  interfaceId: string,
  toolDef: Tool,
  table: PreconditionTable,
  markerStore: PreconditionMarkerStore,
  caseId: string
): Tool {
  const entry = table[interfaceId];

  return {
    ...toolDef,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (args: any, opts?: any) => {
      // ── Precondition check ──
      if (entry) {
        const markers = await markerStore.list(caseId);
        const result = evaluate(entry.rule, new Set(markers));
        if (!result.ok) {
          return generateGuidance(interfaceId, entry, result.missing);
        }
      }

      // ── Execute real tool ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = await (toolDef.execute as any)(args, opts);

      // ── Record success marker ──
      await markerStore.add(caseId, `called:${interfaceId}`);

      return output;
    },
  };
}
