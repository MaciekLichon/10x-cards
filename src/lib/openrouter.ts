import { DEV_AI_FAILURE_MODE } from "astro:env/server";
import { parseProposals, type FlashcardProposal } from "@/lib/flashcards";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 17_000;

export type OpenRouterErrorCode =
  | "configuration"
  | "timeout"
  | "provider_rejection"
  | "malformed_output"
  | "no_proposals";

export class OpenRouterError extends Error {
  constructor(public readonly code: OpenRouterErrorCode) {
    super(code);
    this.name = "OpenRouterError";
  }
}

interface GenerateOptions {
  apiKey: string;
  model: string;
  sourceText: string;
}

function developmentFailureMode(): string | undefined {
  return import.meta.env.DEV ? DEV_AI_FAILURE_MODE : undefined;
}

export async function generateFlashcards({ apiKey, model, sourceText }: GenerateOptions): Promise<FlashcardProposal[]> {
  const failureMode = developmentFailureMode();
  if (failureMode === "provider_timeout") throw new OpenRouterError("timeout");
  if (failureMode === "provider_rejection") throw new OpenRouterError("provider_rejection");
  if (failureMode === "malformed_output") throw new OpenRouterError("malformed_output");

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Create 5 to 15 standalone, non-overlapping flashcards from the source. Use the source language. Keep questions under 200 characters and answers under 500 characters. Return plain text only inside the requested JSON fields. Do not invent filler when the source has fewer useful concepts.",
          },
          { role: "user", content: sourceText },
        ],
        max_tokens: 4_000,
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "flashcard_proposals",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["proposals"],
              properties: {
                proposals: {
                  type: "array",
                  minItems: 1,
                  maxItems: 15,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["question", "answer"],
                    properties: {
                      question: { type: "string", maxLength: 200 },
                      answer: { type: "string", maxLength: 500 },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new OpenRouterError("timeout");
    }
    throw new OpenRouterError("provider_rejection");
  }

  if (!response.ok) {
    throw new OpenRouterError(
      response.status === 400 || response.status === 404 ? "configuration" : "provider_rejection",
    );
  }

  let decoded: unknown;
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) {
      throw new Error("Missing choices");
    }
    const choices = (payload as Record<string, unknown>).choices;
    if (!Array.isArray(choices)) throw new Error("Missing choices");
    const firstValue: unknown = choices[0];
    if (typeof firstValue !== "object" || firstValue === null) throw new Error("Missing message");
    const messageValue = (firstValue as Record<string, unknown>).message;
    if (typeof messageValue !== "object" || messageValue === null) throw new Error("Missing message");
    const content = (messageValue as Record<string, unknown>).content;
    if (typeof content !== "string") {
      throw new Error("Missing content");
    }
    decoded = JSON.parse(content) as unknown;
  } catch {
    throw new OpenRouterError("malformed_output");
  }

  const result = parseProposals(decoded);
  if (!result.success) throw new OpenRouterError("no_proposals");
  return result.data;
}
