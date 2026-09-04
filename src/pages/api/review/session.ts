import type { APIRoute } from "astro";
import { acquireReviewSession } from "@/lib/review-session";
import { createAdminClient } from "@/lib/supabase-admin";

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return jsonError(401, "unauthenticated", "Sign in to review flashcards.");
  const admin = createAdminClient();
  if (!admin) return jsonError(503, "review_unavailable", "Spaced repetition is temporarily unavailable.");

  try {
    const session = await acquireReviewSession(admin, locals.user.id, new Date());
    return Response.json({ session });
  } catch {
    return jsonError(503, "review_unavailable", "Spaced repetition is temporarily unavailable.");
  }
};
