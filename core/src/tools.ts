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
 */
import { tool } from "ai";
import { z } from "zod";

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
