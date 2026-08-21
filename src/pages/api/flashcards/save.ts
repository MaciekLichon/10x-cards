import type { APIRoute } from "astro";
import { DEV_AI_FAILURE_MODE } from "astro:env/server";
import { isSameOriginRequest } from "@/lib/auth";
import { parsePersistedProposals, type PersistedFlashcardProposal } from "@/lib/flashcards";
import { createClient } from "@/lib/supabase";

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function developmentFailureMode(): string | undefined {
  return import.meta.env.DEV ? DEV_AI_FAILURE_MODE : undefined;
}

async function reconcileSave(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  proposals: PersistedFlashcardProposal[],
): Promise<Response> {
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front, back")
    .in(
      "id",
      proposals.map(({ id }) => id),
    );

  if (error)
    return jsonError(503, "save_ambiguous", "The save result could not be confirmed. Do not retry this batch.");
  if (data.length === 0) return jsonError(503, "save_failed", "Flashcards could not be saved. Please try again.");

  const submitted = new Map(proposals.map(({ id, question, answer }) => [id, { front: question, back: answer }]));
  const exactMatch =
    data.length === proposals.length &&
    data.every((row) => {
      const expected = submitted.get(row.id);
      return expected?.front === row.front && expected.back === row.back;
    });

  if (exactMatch) return Response.json({ savedCount: proposals.length });
  return jsonError(409, "save_conflict", "Some flashcards may already exist. Do not retry this batch.");
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!isSameOriginRequest(request)) return jsonError(403, "invalid_origin", "Request origin is not allowed.");
  if (!locals.user) return jsonError(401, "unauthenticated", "Sign in to save flashcards.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonError(415, "invalid_json", "A JSON request body is required.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "The request body is not valid JSON.");
  }
  const proposalValue =
    typeof payload === "object" && payload !== null && "proposals" in payload ? payload.proposals : undefined;
  const parsed = parsePersistedProposals(proposalValue);
  if (!parsed.success) return jsonError(422, "invalid_proposals", "Submit between 1 and 15 valid flashcards.");

  const supabase = createClient(request.headers, cookies);
  if (!supabase) return jsonError(503, "database_unavailable", "Flashcard storage is not configured.");
  const reconcileOnly =
    typeof payload === "object" && payload !== null && "reconcile" in payload && payload.reconcile === true;
  if (reconcileOnly) return reconcileSave(supabase, parsed.data);
  const isConfirmedFailureRetry = import.meta.env.DEV && request.headers.get("x-dev-ai-retry") === "confirmed-failure";
  if (developmentFailureMode() === "save_failure" && !isConfirmedFailureRetry) {
    return jsonError(503, "save_failed", "Flashcards could not be saved. Please try again.");
  }

  const rows = parsed.data.map(({ id, question, answer }) => ({ id, front: question, back: answer }));
  try {
    const { error, status } = await supabase.from("flashcards").insert(rows);
    if (error && status === 0) return await reconcileSave(supabase, parsed.data);
    if (error) return jsonError(503, "save_failed", "Flashcards could not be saved. Please try again.");
  } catch {
    return reconcileSave(supabase, parsed.data);
  }

  if (developmentFailureMode() === "save_lost_response") {
    return jsonError(503, "save_ambiguous", "The save result must be reconciled before retrying.");
  }
  return Response.json({ savedCount: parsed.data.length });
};
