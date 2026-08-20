import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import { isSameOriginRequest } from "@/lib/auth";
import { parseSourceText } from "@/lib/flashcards";
import { generateFlashcards, OpenRouterError } from "@/lib/openrouter";

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  if (!isSameOriginRequest(request)) return jsonError(403, "invalid_origin", "Request origin is not allowed.");
  if (!locals.user) return jsonError(401, "unauthenticated", "Sign in to generate flashcards.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonError(415, "invalid_json", "A JSON request body is required.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "The request body is not valid JSON.");
  }
  const sourceTextValue =
    typeof payload === "object" && payload !== null && "sourceText" in payload ? payload.sourceText : undefined;
  const source = parseSourceText(sourceTextValue);
  if (!source.success) return jsonError(422, "invalid_source", "Source text must contain 1,000 to 10,000 characters.");

  const apiKey = OPENROUTER_API_KEY?.trim();
  const model = OPENROUTER_MODEL?.trim();
  if (!apiKey || !model) return jsonError(503, "ai_not_configured", "AI generation is not configured.");

  try {
    const proposals = await generateFlashcards({ apiKey, model, sourceText: source.data });
    console.info("Flashcard generation completed", {
      requestId,
      elapsedMs: Date.now() - startedAt,
      sourceCharacters: source.data.length,
      proposalCount: proposals.length,
      providerStatus: "success",
    });
    return Response.json({ proposals, sparse: proposals.length < 5 });
  } catch (error) {
    const code = error instanceof OpenRouterError ? error.code : "provider_rejection";
    console.error("Flashcard generation failed", {
      requestId,
      elapsedMs: Date.now() - startedAt,
      sourceCharacters: source.data.length,
      providerStatus: code,
    });
    if (code === "timeout") return jsonError(504, "provider_timeout", "AI generation timed out. Please try again.");
    if (code === "configuration") {
      return jsonError(
        503,
        "unsupported_ai_configuration",
        "The configured AI model cannot generate structured output.",
      );
    }
    if (code === "malformed_output") return jsonError(502, "malformed_output", "AI returned an unreadable response.");
    if (code === "no_proposals")
      return jsonError(422, "no_usable_proposals", "No usable flashcards could be generated.");
    return jsonError(502, "provider_failure", "AI generation is temporarily unavailable.");
  }
};
