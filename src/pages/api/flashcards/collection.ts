import type { APIRoute } from "astro";
import { DEV_COLLECTION_FAILURE_MODE } from "astro:env/server";
import { isSameOriginRequest } from "@/lib/auth";
import {
  COLLECTION_PAGE_SIZE,
  canonicalizeDatabaseTimestamp,
  encodeCollectionCursor,
  parseCollectionCursor,
  parseManualFlashcard,
  type CollectionFlashcard,
  type ManualFlashcardInput,
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

async function reconcileSave(supabase: SupabaseClient, submitted: ManualFlashcardInput): Promise<Response> {
  if (developmentFailureMode() === "reconcile_failure") {
    return jsonError(503, "save_ambiguous", "The save result could not be confirmed. Do not retry this card.");
  }

  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front, back, created_at, updated_at")
    .eq("id", submitted.id)
    .maybeSingle();
  if (error) return jsonError(503, "save_ambiguous", "The save result could not be confirmed. Do not retry this card.");
  if (!data) return jsonError(503, "save_failed", "The flashcard could not be saved. Please try again.");
  if (data.front !== submitted.front || data.back !== submitted.back) {
    return jsonError(409, "save_conflict", "This flashcard ID is already associated with different content.");
  }
  return Response.json({ flashcard: publicFlashcard(data) });
}

async function reconcileDuplicate(supabase: SupabaseClient, submitted: ManualFlashcardInput): Promise<Response> {
  if (developmentFailureMode() === "reconcile_failure") {
    return jsonError(503, "save_ambiguous", "The save result could not be confirmed. Do not retry this card.");
  }

  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front, back, created_at, updated_at")
    .eq("id", submitted.id)
    .maybeSingle();
  if (error) return jsonError(503, "save_ambiguous", "The save result could not be confirmed. Do not retry this card.");
  if (!data) return jsonError(409, "id_conflict", "This flashcard ID cannot be used. Do not retry this card.");
  if (data.front !== submitted.front || data.back !== submitted.back) {
    return jsonError(409, "save_conflict", "This flashcard ID is already associated with different content.");
  }
  return Response.json({ flashcard: publicFlashcard(data) });
}

export const GET: APIRoute = async ({ url, locals, request, cookies }) => {
  if (!locals.user) return jsonError(401, "unauthenticated", "Sign in to view your collection.");
  if (developmentFailureMode() === "read_failure") {
    return jsonError(503, "collection_unavailable", "Your collection is temporarily unavailable.");
  }

  const cursorValue = url.searchParams.get("cursor");
  const cursor = cursorValue === null ? null : parseCollectionCursor(cursorValue);
  if (cursor && !cursor.success) return jsonError(400, "invalid_cursor", "The collection cursor is invalid.");
  const supabase = createClient(request.headers, cookies);
  if (!supabase) return jsonError(503, "database_unavailable", "Flashcard storage is not configured.");

  let query = supabase
    .from("flashcards")
    .select("id, front, back, created_at, updated_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(COLLECTION_PAGE_SIZE + 1);
  if (cursor?.success) {
    query = query.or(
      `created_at.lt.${cursor.data.createdAt},and(created_at.eq.${cursor.data.createdAt},id.lt.${cursor.data.id})`,
    );
  }

  const { data, error } = await query;
  if (error) return jsonError(503, "collection_unavailable", "Your collection is temporarily unavailable.");
  const page = data.slice(0, COLLECTION_PAGE_SIZE);
  const last = page.at(-1);
  const nextCursor =
    data.length > COLLECTION_PAGE_SIZE && last
      ? encodeCollectionCursor({ createdAt: new Date(last.created_at).toISOString(), id: last.id })
      : null;
  return Response.json({ flashcards: page.map(publicFlashcard), nextCursor });
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!isSameOriginRequest(request)) return jsonError(403, "invalid_origin", "Request origin is not allowed.");
  if (!locals.user) return jsonError(401, "unauthenticated", "Sign in to create flashcards.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonError(415, "invalid_json", "A JSON request body is required.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "The request body is not valid JSON.");
  }
  const parsed = parseManualFlashcard(payload);
  if (!parsed.success) return jsonError(422, "invalid_flashcard", "Submit a valid front and back.");
  const supabase = createClient(request.headers, cookies);
  if (!supabase) return jsonError(503, "database_unavailable", "Flashcard storage is not configured.");

  const reconcileOnly =
    typeof payload === "object" && payload !== null && "reconcile" in payload && payload.reconcile === true;
  if (reconcileOnly) return reconcileSave(supabase, parsed.data);
  if (developmentFailureMode() === "save_failure") {
    return jsonError(503, "save_failed", "The flashcard could not be saved. Please try again.");
  }

  try {
    const { data, error, status } = await supabase
      .from("flashcards")
      .insert(parsed.data)
      .select("id, front, back, created_at, updated_at")
      .single();
    if (error?.code === "23505") return await reconcileDuplicate(supabase, parsed.data);
    if (error && status === 0) return await reconcileSave(supabase, parsed.data);
    if (error) return jsonError(503, "save_failed", "The flashcard could not be saved. Please try again.");
    if (developmentFailureMode() === "save_lost_response") {
      return jsonError(503, "save_ambiguous", "The save result must be reconciled before retrying.");
    }
    return Response.json({ flashcard: publicFlashcard(data) });
  } catch {
    return reconcileSave(supabase, parsed.data);
  }
};
