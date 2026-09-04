import {
  canonicalIso,
  type ReviewCardDisposition,
  type ReviewSessionDto,
  type ReviewSessionRow,
  type ScheduledFlashcardRow,
} from "@/lib/spaced-repetition";
import type { AdminClient } from "@/lib/supabase-admin";

export async function acquireReviewSession(
  admin: AdminClient,
  userId: string,
  cutoff: Date,
): Promise<ReviewSessionDto> {
  const { data, error } = await admin.rpc("get_or_create_review_session", {
    p_user_id: userId,
    p_cutoff: cutoff.toISOString(),
  });
  if (error || !isSessionRpcResult(data)) throw new Error("review_session_unavailable");
  return readReviewSession(admin, userId, data.id, cutoff);
}

export async function readReviewSession(
  admin: AdminClient,
  userId: string,
  sessionId: string,
  now = new Date(),
): Promise<ReviewSessionDto> {
  const [{ data: session, error: sessionError }, { data: members, error: membersError }] = await Promise.all([
    admin.from("flashcard_review_sessions").select("*").eq("user_id", userId).eq("id", sessionId).maybeSingle(),
    admin
      .from("flashcard_review_session_cards")
      .select("*")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("ordinal", { ascending: true }),
  ]);
  if (sessionError || membersError || !session) throw new Error("review_session_unavailable");

  const cardIds = members.map(({ flashcard_id }) => flashcard_id);
  const cardsById = new Map<string, ScheduledFlashcardRow>();
  if (cardIds.length > 0) {
    const { data: cards, error: cardsError } = await admin
      .from("flashcards")
      .select("*")
      .eq("user_id", userId)
      .in("id", cardIds);
    if (cardsError) throw new Error("review_session_unavailable");
    for (const card of cards) cardsById.set(card.id, card);
  }

  const publicCards = members.flatMap((member) => {
    const card = cardsById.get(member.flashcard_id);
    if (!card) return [];
    const disposition = effectiveDisposition(member.state, member.next_due, now);
    return [
      {
        id: card.id,
        front: card.front,
        back: card.back,
        due: canonicalIso(member.next_due ?? card.due),
        disposition,
        ordinal: member.ordinal,
        reviewCount: member.review_count,
        scheduleVersion: card.schedule_version,
      },
    ];
  });
  publicCards.sort((left, right) => {
    const rank = (value: ReviewCardDisposition) => (value === "ready" ? 0 : value === "waiting" ? 1 : 2);
    return (
      rank(left.disposition) - rank(right.disposition) ||
      left.due.localeCompare(right.due) ||
      left.ordinal - right.ordinal
    );
  });

  return {
    id: session.id,
    status: members.length === 0 ? "empty" : session.status === "completed" ? "completed" : "active",
    cutoff: canonicalIso(session.cutoff),
    expiresAt: canonicalIso(session.expires_at),
    cards: publicCards,
    summary: {
      totalCount: members.length,
      remainingCount: members.filter(({ state }) => state !== "completed" && state !== "deferred").length,
      reviewedCount: session.reviewed_count,
      againCount: session.again_count,
      hardCount: session.hard_count,
      goodCount: session.good_count,
      easyCount: session.easy_count,
      deferredCount: session.deferred_count,
    },
  };
}

function effectiveDisposition(state: string, nextDue: string | null, now: Date): ReviewCardDisposition {
  if (state === "waiting" && nextDue && new Date(nextDue).getTime() <= now.getTime()) return "ready";
  if (state === "ready" || state === "waiting" || state === "deferred" || state === "completed") return state;
  return "ready";
}

function isSessionRpcResult(value: unknown): value is Pick<ReviewSessionRow, "id"> {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}
