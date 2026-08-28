import type { APIRoute } from "astro";
import { DEV_COLLECTION_FAILURE_MODE } from "astro:env/server";
import { isSameOriginRequest } from "@/lib/auth";
import {
  canonicalizeDatabaseTimestamp,
  parseDeleteFlashcard,
  parseFlashcardId,
  parseUpdateFlashcard,
  type CollectionFlashcard,
  type DeleteFlashcardInput,
  type UpdateFlashcardInput,
} from "@/lib/flashcards";
import { createClient } from "@/lib/supabase";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

interface FlashcardRow {
  id: string;
  front: string;
  back: string;
  created_at: string;
  updated_at: string;
}

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function developmentFailureMode(): string | undefined {
  return import.meta.env.DEV ? DEV_COLLECTION_FAILURE_MODE : undefined;
}

function publicFlashcard(row: FlashcardRow): CollectionFlashcard {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    createdAt: canonicalizeDatabaseTimestamp(row.created_at),
    updatedAt: canonicalizeDatabaseTimestamp(row.updated_at),
  };
}

async function parseJsonRequest(
  request: Request,
): Promise<{ success: true; data: unknown } | { success: false; response: Response }> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { success: false, response: jsonError(415, "invalid_json", "A JSON request body is required.") };
  }
  try {
    return { success: true, data: await request.json() };
  } catch {
    return { success: false, response: jsonError(400, "invalid_json", "The request body is not valid JSON.") };
  }
}

async function classifyZeroRows(supabase: SupabaseClient, id: string): Promise<Response> {
  try {
    const { data, error, status } = await supabase
      .from("flashcards")
      .select("id, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error || status === 0) {
      return jsonError(503, "mutation_ambiguous", "The mutation result could not be confirmed. Do not retry yet.");
    }
    if (data) {
      return jsonError(409, "mutation_conflict", "This flashcard changed. Refresh it before trying again.");
    }
    return jsonError(404, "flashcard_not_found", "The flashcard was not found.");
  } catch {
    return jsonError(503, "mutation_ambiguous", "The mutation result could not be confirmed. Do not retry yet.");
  }
}

function validateRequest(request: Request, user: App.Locals["user"]): Response | null {
  if (!isSameOriginRequest(request)) return jsonError(403, "invalid_origin", "Request origin is not allowed.");
  if (!user) return jsonError(401, "unauthenticated", "Sign in to manage flashcards.");
  return null;
}

function validatePathId(
  pathValue: string | undefined,
): { success: true; id: string } | { success: false; response: Response } {
  const parsed = parseFlashcardId(pathValue);
  if (!parsed.success) {
    return { success: false, response: jsonError(400, "invalid_flashcard_id", "The flashcard ID is invalid.") };
  }
  return { success: true, id: parsed.data };
}

function pathMatchesBody(pathId: string, body: UpdateFlashcardInput | DeleteFlashcardInput): Response | null {
  return pathId === body.id
    ? null
    : jsonError(400, "invalid_flashcard_id", "The path and request flashcard IDs must match.");
}

export const PATCH: APIRoute = async ({ request, locals, cookies, params }) => {
  const rejected = validateRequest(request, locals.user);
  if (rejected) return rejected;
  const path = validatePathId(params.id);
  if (!path.success) return path.response;
  const payload = await parseJsonRequest(request);
  if (!payload.success) return payload.response;
  const parsed = parseUpdateFlashcard(payload.data);
  if (!parsed.success) return jsonError(422, "invalid_flashcard", "Submit a valid flashcard update.");
  const mismatch = pathMatchesBody(path.id, parsed.data);
  if (mismatch) return mismatch;
  const supabase = createClient(request.headers, cookies);
  if (!supabase) return jsonError(503, "database_unavailable", "Flashcard storage is not configured.");
  if (developmentFailureMode() === "update_failure") {
    return jsonError(503, "update_failed", "The flashcard could not be updated. Please try again.");
  }

  try {
    const { data, error, status } = await supabase
      .from("flashcards")
      .update({ front: parsed.data.front, back: parsed.data.back })
      .eq("id", path.id)
      .eq("updated_at", parsed.data.updatedAt)
      .select("id, front, back, created_at, updated_at");
    if (error && status === 0) {
      return jsonError(503, "mutation_ambiguous", "The update result could not be confirmed. Do not retry yet.");
    }
    if (error) return jsonError(503, "update_failed", "The flashcard could not be updated. Please try again.");
    if (data.length === 0) return await classifyZeroRows(supabase, path.id);
    if (developmentFailureMode() === "update_lost_response") {
      return jsonError(503, "mutation_ambiguous", "The update result could not be confirmed. Do not retry yet.");
    }
    return Response.json({ flashcard: publicFlashcard(data[0]) });
  } catch {
    return jsonError(503, "mutation_ambiguous", "The update result could not be confirmed. Do not retry yet.");
  }
};

export const DELETE: APIRoute = async ({ request, locals, cookies, params }) => {
  const rejected = validateRequest(request, locals.user);
  if (rejected) return rejected;
  const path = validatePathId(params.id);
  if (!path.success) return path.response;
  const payload = await parseJsonRequest(request);
  if (!payload.success) return payload.response;
  const parsed = parseDeleteFlashcard(payload.data);
  if (!parsed.success) return jsonError(422, "invalid_flashcard", "Submit a valid flashcard deletion.");
  const mismatch = pathMatchesBody(path.id, parsed.data);
  if (mismatch) return mismatch;
  const supabase = createClient(request.headers, cookies);
  if (!supabase) return jsonError(503, "database_unavailable", "Flashcard storage is not configured.");
  if (developmentFailureMode() === "delete_failure") {
    return jsonError(503, "delete_failed", "The flashcard could not be deleted. Please try again.");
  }

  try {
    const { data, error, status } = await supabase
      .from("flashcards")
      .delete()
      .eq("id", path.id)
      .eq("updated_at", parsed.data.updatedAt)
      .select("id");
    if (error && status === 0) {
      return jsonError(503, "mutation_ambiguous", "The delete result could not be confirmed. Do not retry yet.");
    }
    if (error) return jsonError(503, "delete_failed", "The flashcard could not be deleted. Please try again.");
    if (data.length === 0) return await classifyZeroRows(supabase, path.id);
    if (developmentFailureMode() === "delete_lost_response") {
      return jsonError(503, "mutation_ambiguous", "The delete result could not be confirmed. Do not retry yet.");
    }
    return Response.json({ deletedId: data[0].id });
  } catch {
    return jsonError(503, "mutation_ambiguous", "The delete result could not be confirmed. Do not retry yet.");
  }
};
