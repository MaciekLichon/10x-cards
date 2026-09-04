import type { APIRoute } from "astro";
import { isSameOriginRequest } from "@/lib/auth";
import { scheduleReview } from "@/lib/fsrs";
import { acquireReviewSession, readReviewSession } from "@/lib/review-session";
import {
  REVIEW_WAIT_THRESHOLD_SECONDS,
  SCHEDULER_CONFIG_VERSION,
  SCHEDULER_PACKAGE_VERSION,
  isJsonObject,
  parseRateReviewInput,
  type RateReviewResultDto,
  type ReviewCardDisposition,
  type ReviewSessionDto,
} from "@/lib/spaced-repetition";
import { createAdminClient } from "@/lib/supabase-admin";

function jsonError(status: number, code: string, message: string, session?: ReviewSessionDto): Response {
  return Response.json({ error: { code, message }, ...(session ? { session } : {}) }, { status });
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

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isSameOriginRequest(request)) return jsonError(403, "invalid_origin", "Request origin is not allowed.");
  if (!locals.user) return jsonError(401, "unauthenticated", "Sign in to review flashcards.");
  const payload = await parseJsonRequest(request);
  if (!payload.success) return payload.response;
  const parsed = parseRateReviewInput(payload.data);
  if (!parsed.success) return jsonError(422, "invalid_rating_request", "Submit a valid rating request.");

  const admin = createAdminClient();
  if (!admin) return jsonError(503, "review_unavailable", "Spaced repetition is temporarily unavailable.");
  const reviewedAt = new Date();

  try {
    const replayLookup = await admin
      .from("flashcard_review_logs")
      .select("request_id")
      .eq("user_id", locals.user.id)
      .eq("request_id", parsed.data.requestId)
      .maybeSingle();
    if (replayLookup.error) throw new Error("review_lookup_failed");
    if (replayLookup.data) {
      const { data: replayed, error: replayError } = await admin.rpc("apply_flashcard_review", {
        p_user_id: locals.user.id,
        p_session_id: parsed.data.sessionId,
        p_request_id: parsed.data.requestId,
        p_flashcard_id: parsed.data.cardId,
        p_rating: parsed.data.rating,
        p_expected_schedule_version: parsed.data.expectedScheduleVersion,
        p_reviewed_at: reviewedAt.toISOString(),
        p_post_state: {},
        p_result: {},
      });
      if (replayError) return await mapReviewError(admin, locals.user.id, replayError.message);
      return await successfulReviewResponse(admin, locals.user.id, replayed, parsed.data.rating, reviewedAt);
    }

    const [sessionResult, memberResult, cardResult] = await Promise.all([
      admin
        .from("flashcard_review_sessions")
        .select("id, status, expires_at")
        .eq("user_id", locals.user.id)
        .eq("id", parsed.data.sessionId)
        .maybeSingle(),
      admin
        .from("flashcard_review_session_cards")
        .select("state, next_due")
        .eq("user_id", locals.user.id)
        .eq("session_id", parsed.data.sessionId)
        .eq("flashcard_id", parsed.data.cardId)
        .maybeSingle(),
      admin.from("flashcards").select("*").eq("user_id", locals.user.id).eq("id", parsed.data.cardId).maybeSingle(),
    ]);
    const { data: session } = sessionResult;
    const { data: member } = memberResult;
    const { data: card } = cardResult;

    if (sessionResult.error || memberResult.error || cardResult.error) {
      throw new Error("review_lookup_failed");
    }
    const sessionExpiresAt = dateMillis(session?.expires_at);
    const cardDue = dateMillis(card?.due);
    if (!session || !member || !card || sessionExpiresAt === null || cardDue === null) {
      return jsonError(404, "review_card_unavailable", "The review item is unavailable.");
    }
    if (session.status !== "active" || sessionExpiresAt <= reviewedAt.getTime()) {
      return await conflictResponse(admin, locals.user.id, "review_session_changed", "The review session changed.");
    }
    if (member.state === "completed" || member.state === "deferred") {
      return await conflictResponse(
        admin,
        locals.user.id,
        "review_progress_changed",
        "Review progress changed elsewhere.",
      );
    }
    if (card.schedule_version !== parsed.data.expectedScheduleVersion) {
      return await conflictResponse(admin, locals.user.id, "stale_schedule_version", "This card was already reviewed.");
    }
    if (cardDue > reviewedAt.getTime()) {
      return await conflictResponse(admin, locals.user.id, "review_card_not_due", "This card is not due yet.");
    }

    const scheduled = scheduleReview(card, reviewedAt, parsed.data.rating);
    const disposition: ReviewCardDisposition =
      new Date(scheduled.nextDue).getTime() <= reviewedAt.getTime()
        ? "ready"
        : new Date(scheduled.nextDue).getTime() <= reviewedAt.getTime() + REVIEW_WAIT_THRESHOLD_SECONDS * 1_000
          ? "waiting"
          : "deferred";
    const canonicalResult = {
      requestId: parsed.data.requestId,
      sessionId: parsed.data.sessionId,
      cardId: parsed.data.cardId,
      rating: parsed.data.rating,
      nextDue: scheduled.nextDue,
      disposition,
      schedulerVersion: SCHEDULER_PACKAGE_VERSION,
      configVersion: SCHEDULER_CONFIG_VERSION,
    };
    const { data: rpcResult, error } = await admin.rpc("apply_flashcard_review", {
      p_user_id: locals.user.id,
      p_session_id: parsed.data.sessionId,
      p_request_id: parsed.data.requestId,
      p_flashcard_id: parsed.data.cardId,
      p_rating: parsed.data.rating,
      p_expected_schedule_version: parsed.data.expectedScheduleVersion,
      p_reviewed_at: reviewedAt.toISOString(),
      p_post_state: scheduled.postState,
      p_result: canonicalResult,
    });
    if (error) return await mapReviewError(admin, locals.user.id, error.message);
    return await successfulReviewResponse(admin, locals.user.id, rpcResult, parsed.data.rating, reviewedAt);
  } catch {
    return jsonError(
      503,
      "review_ambiguous",
      "The rating result could not be confirmed. Retry with the same request ID.",
    );
  }
};

async function conflictResponse(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  code: string,
  message: string,
): Promise<Response> {
  try {
    return jsonError(409, code, message, await acquireReviewSession(admin, userId, new Date()));
  } catch {
    return jsonError(409, code, message);
  }
}

async function mapReviewError(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  message: string,
): Promise<Response> {
  if (message.includes("review_request_conflict")) {
    return await conflictResponse(admin, userId, "review_request_conflict", "This request ID was already used.");
  }
  if (message.includes("stale_schedule_version")) {
    return await conflictResponse(admin, userId, "stale_schedule_version", "This card was already reviewed.");
  }
  if (message.includes("review_session_unavailable") || message.includes("review_card_not_in_session")) {
    return await conflictResponse(admin, userId, "review_progress_changed", "Review progress changed elsewhere.");
  }
  if (message.includes("review_card_unavailable")) {
    return jsonError(404, "review_card_unavailable", "The review item is unavailable.");
  }
  if (message.includes("invalid_rating") || message.includes("invalid_post_state")) {
    return jsonError(422, "invalid_rating_request", "The rating request is invalid.");
  }
  if (message.includes("review_card_not_due")) {
    return await conflictResponse(admin, userId, "review_card_not_due", "This card is not due yet.");
  }
  return jsonError(
    503,
    "review_ambiguous",
    "The rating result could not be confirmed. Retry with the same request ID.",
  );
}

interface CanonicalRpcResult {
  outcome: "applied" | "replayed";
  requestId: string;
  sessionId: string;
  cardId: string;
  reviewed_at: string;
  nextDue: string;
  schedule_version: number;
  disposition: ReviewCardDisposition;
}

function isCanonicalRpcResult(value: unknown): value is CanonicalRpcResult {
  if (!isJsonObject(value)) return false;
  return (
    (value.outcome === "applied" || value.outcome === "replayed") &&
    typeof value.requestId === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.cardId === "string" &&
    typeof value.reviewed_at === "string" &&
    Number.isFinite(Date.parse(value.reviewed_at)) &&
    typeof value.nextDue === "string" &&
    Number.isFinite(Date.parse(value.nextDue)) &&
    typeof value.schedule_version === "number" &&
    (value.disposition === "ready" ||
      value.disposition === "waiting" ||
      value.disposition === "deferred" ||
      value.disposition === "completed")
  );
}

function dateMillis(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

async function successfulReviewResponse(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  rpcResult: unknown,
  rating: RateReviewResultDto["rating"],
  now: Date,
): Promise<Response> {
  if (!isCanonicalRpcResult(rpcResult)) throw new Error("invalid_review_result");
  const session = await readReviewSession(admin, userId, rpcResult.sessionId, now);
  const result: RateReviewResultDto = {
    outcome: rpcResult.outcome,
    requestId: rpcResult.requestId,
    sessionId: rpcResult.sessionId,
    cardId: rpcResult.cardId,
    rating,
    reviewedAt: new Date(rpcResult.reviewed_at).toISOString(),
    nextDue: new Date(rpcResult.nextDue).toISOString(),
    scheduleVersion: rpcResult.schedule_version,
    disposition: rpcResult.disposition,
    session,
  };
  return Response.json({ result });
}
