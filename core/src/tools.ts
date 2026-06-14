/**
 * Tool definitions for the Agent Loop.
 *
 * Evidence Tools: needsApproval omitted → automatic (unattended).
 * Action Tools:  needsApproval: true → human-approval path.
 *
 * Uses inputSchema (Vercel AI SDK v6 name — NOT parameters).
 * Does NOT use dynamicTool() — v6 lacks needsApproval there (#11434).
 */
import { tool } from "ai";
import { z } from "zod";

// ─── Evidence Tools (automatic path) ─────────────────────────────────────────

/**
 * Stub: look up an asset by hostname.
 * Evidence Tool — no approval needed.
 */
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

/**
 * Stub: look up IP reputation.
 * Evidence Tool — no approval needed.
 */
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

// ─── Action Tools (human-approval path) ──────────────────────────────────────

/**
 * Stub: block an IP address via Action Executor.
 * Action Tool — needsApproval: true → human must confirm via Policy Gate.
 */
export const blockIpTool = tool({
  description:
    "Block an IP address on the perimeter firewall. Requires human approval (Policy Gate).",
  inputSchema: z.object({
    ip: z.string().describe("IP address to block"),
    reason: z.string().describe("Reason for blocking"),
  }),
  needsApproval: true,
  // execute runs only AFTER human approval: needsApproval makes the SDK pause
  // (emitting tool-approval-request) instead of calling this on the first pass.
  execute: async ({ ip, reason }) => {
    // Stub — real Action Executor plugs in here
    return { blocked: ip, reason, executedAt: new Date().toISOString() };
  },
});

/** Union of all Evidence Tool names (automatic path) */
export const evidenceTools = {
  lookupAsset: lookupAssetTool,
  lookupIp: lookupIpTool,
} as const;

/** Union of all Action Tool names (human-approval path) */
export const actionTools = {
  blockIp: blockIpTool,
} as const;

/** Full tool set exposed to the model */
export const allTools = {
  ...evidenceTools,
  ...actionTools,
} as const;

export type AllTools = typeof allTools;
