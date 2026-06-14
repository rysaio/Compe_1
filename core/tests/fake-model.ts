/**
 * Fake/mock LanguageModel (v3 spec) for unit tests — no network required.
 *
 * Implements the LanguageModelV3 spec (used internally by AI SDK 6.x).
 * Each call consumes one "turn" from the script array, making tests
 * deterministic and reproducible.
 *
 * Content uses the v3 format:
 *   - text parts: { type: "text", text: string }
 *   - tool-call parts: { type: "tool-call", toolCallId, toolName, input: string }
 *     Note: `input` must be a JSON string (NOT `args`).
 */

export interface FakeTurn {
  /** Text the model "says" */
  text?: string;
  /** Tool calls the model emits (if any) */
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    /** Tool input as a plain object (serialized to JSON for the SDK) */
    args: Record<string, unknown>;
  }>;
  /** Finish reason — default "stop" */
  finishReason?: "stop" | "length" | "tool-calls" | "content-filter" | "error" | "other";
}

/** Creates a LanguageModelV3-compatible fake model that replays a fixed script. */
export function createFakeModel(script: FakeTurn[]) {
  let callIndex = 0;

  const model = {
    specificationVersion: "v3" as const,
    provider: "fake",
    modelId: "fake-model",
    defaultObjectGenerationMode: undefined as unknown as undefined,

    async doGenerate(_options: unknown): Promise<unknown> {
      const turn = script[callIndex++];
      if (!turn) {
        throw new Error(
          `FakeModel: call #${callIndex} but script only has ${script.length} turns`
        );
      }

      const content: unknown[] = [];

      if (turn.text) {
        content.push({ type: "text", text: turn.text });
      }

      for (const tc of turn.toolCalls ?? []) {
        content.push({
          type: "tool-call",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          // SDK v3 uses `input` (JSON string), not `args`
          input: JSON.stringify(tc.args),
        });
      }

      return {
        content,
        finishReason: {
          unified: turn.finishReason ?? "stop",
          raw: undefined,
        },
        usage: {
          inputTokens: {
            total: 10,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 5,
            text: undefined,
            reasoning: undefined,
          },
        },
        rawCall: { rawPrompt: null, rawSettings: {} },
        response: {
          id: `fake-resp-${callIndex}`,
          timestamp: new Date(),
          modelId: "fake-model",
        },
      };
    },

    async doStream(_options: unknown): Promise<unknown> {
      // Delegate to doGenerate; reconstruct a streaming response.
      const result = (await model.doGenerate(_options)) as {
        content: Array<{
          type: string;
          text?: string;
          toolCallId?: string;
          toolName?: string;
          input?: string;
        }>;
        finishReason: { unified: string };
        usage: unknown;
        rawCall: unknown;
      };

      const parts: unknown[] = [{ type: "start" }];

      for (const part of result.content) {
        if (part.type === "text") {
          parts.push({ type: "text-delta", textDelta: part.text });
        } else if (part.type === "tool-call") {
          parts.push({
            type: "tool-call",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          });
        }
      }

      parts.push({
        type: "finish",
        finishReason: result.finishReason,
        usage: result.usage,
      });

      const stream = new ReadableStream({
        start(controller) {
          for (const p of parts) {
            controller.enqueue(p);
          }
          controller.close();
        },
      });

      return { stream, rawCall: result.rawCall };
    },
  };

  return model;
}
