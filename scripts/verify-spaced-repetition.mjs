import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import process, { loadEnvFile } from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env", ".dev.vars"]) {
  if (existsSync(envFile)) loadEnvFile(envFile);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || !serviceRoleKey) {
  throw new Error("SUPABASE_URL, SUPABASE_KEY, and SUPABASE_SERVICE_ROLE_KEY are required for the local verifier.");
}

const configuredUrl = new URL(supabaseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(configuredUrl.hostname)) {
  throw new Error("Refusing to run against a non-local Supabase URL. Use a resettable local stack.");
}

const localConfig = readFileSync("supabase/config.toml", "utf8");
const inbucketSection = localConfig.match(/\[inbucket\]([\s\S]*?)(?:\n\[|$)/)?.[1];
const inbucketPort = inbucketSection?.match(/^port\s*=\s*(\d+)\s*$/m)?.[1];
if (!inbucketPort) throw new Error("Local Mailpit port is missing from supabase/config.toml.");
const mailpitUrl = new URL(`http://${configuredUrl.hostname}:${inbucketPort}`);

const clientOptions = {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
};
const ownerClient = createClient(supabaseUrl, supabaseKey, clientOptions);
const otherClient = createClient(supabaseUrl, supabaseKey, clientOptions);
const anonymousClient = createClient(supabaseUrl, supabaseKey, clientOptions);
const fixtureClient = createClient(supabaseUrl, serviceRoleKey, clientOptions);
const runId = `${Date.now()}-${randomUUID()}`;
const password = `Local-only-${randomUUID()}-Aa1!`;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function check(condition, message) {
  assert.ok(condition, `FAIL: ${message}`);
  pass(message);
}

function checkDeepEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, `FAIL: ${message}`);
  pass(message);
}

function canonicalFields(result) {
  return {
    requestId: result.requestId,
    sessionId: result.sessionId,
    cardId: result.cardId,
    rating: result.rating,
    nextDue: result.nextDue,
    disposition: result.disposition,
    schedulerVersion: result.schedulerVersion,
    configVersion: result.configVersion,
    reviewed_at: result.reviewed_at,
    schedule_version: result.schedule_version,
  };
}

async function createAuthenticatedUser(client, label) {
  const email = `review-${label}-${runId}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password });
  check(!error && Boolean(data.user?.id), `${label} signs up through the ordinary client`);

  let token;
  for (let attempt = 0; attempt < 20 && !token; attempt += 1) {
    const searchUrl = new URL("/api/v1/search", mailpitUrl);
    searchUrl.searchParams.set("query", `to:${email}`);
    searchUrl.searchParams.set("limit", "1");
    const searchResponse = await globalThis.fetch(searchUrl);
    if (searchResponse.ok) {
      const search = await searchResponse.json();
      const messageId = search.messages?.[0]?.ID;
      if (messageId) {
        const messageResponse = await globalThis.fetch(new URL(`/api/v1/message/${messageId}`, mailpitUrl));
        if (messageResponse.ok) {
          const message = await messageResponse.json();
          token = message.Text?.match(/enter the code:\s*(\d+)/i)?.[1];
        }
      }
    }
    if (!token) await delay(250);
  }
  check(Boolean(token), `${label} confirmation reaches local Mailpit`);

  const { data: verified, error: verificationError } = await client.auth.verifyOtp({ email, token, type: "signup" });
  check(!verificationError && Boolean(verified.session), `${label} confirms through the ordinary client`);
  return verified.user.id;
}

function canonicalResult({ requestId, sessionId, cardId, rating, nextDue }) {
  return {
    requestId,
    sessionId,
    cardId,
    rating,
    nextDue,
    disposition: "deferred",
    schedulerVersion: "5.4.2",
    configVersion: "fsrs-v6-defaults-v1",
  };
}

function postState(nextDue) {
  return {
    due: nextDue,
    stability: 2.3,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 10,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    last_review: null,
  };
}

async function main() {
  console.log("Verifying spaced repetition against the local Supabase API...");
  const ownerId = await createAuthenticatedUser(ownerClient, "owner");
  const otherId = await createAuthenticatedUser(otherClient, "other");
  const baseTime = Date.now() - 60_000;
  const ownerCards = Array.from({ length: 22 }, (_, index) => ({
    id: randomUUID(),
    user_id: ownerId,
    front: `Owner fixture ${index + 1}`,
    back: "Local verification fixture",
    due: new Date(baseTime + index).toISOString(),
  }));
  const otherCard = {
    id: randomUUID(),
    user_id: otherId,
    front: "Other fixture",
    back: "Local verification fixture",
    due: new Date(baseTime - 1).toISOString(),
  };
  const { error: seedError } = await fixtureClient.from("flashcards").insert([...ownerCards, otherCard]);
  check(!seedError, "privileged fixture setup creates cards for both ordinary users");

  const cutoff = new Date();
  const acquisitions = await Promise.all([
    fixtureClient.rpc("get_or_create_review_session", { p_user_id: ownerId, p_cutoff: cutoff.toISOString() }),
    fixtureClient.rpc("get_or_create_review_session", { p_user_id: ownerId, p_cutoff: cutoff.toISOString() }),
  ]);
  check(
    acquisitions.every(({ error }) => !error),
    "concurrent session acquisitions succeed",
  );
  const sessionId = acquisitions[0].data.id;
  check(sessionId === acquisitions[1].data.id, "concurrent acquisition returns one active session");

  const { data: membership, error: membershipError } = await ownerClient
    .from("flashcard_review_session_cards")
    .select("flashcard_id, ordinal")
    .eq("session_id", sessionId)
    .order("ordinal");
  check(!membershipError && membership.length === 20, "owner reads a session capped at 20 due cards");
  check(
    membership.every(({ flashcard_id }, index) => flashcard_id === ownerCards[index].id),
    "session membership follows deterministic due then id order",
  );

  const { data: otherSessions, error: otherSessionError } = await otherClient
    .from("flashcard_review_sessions")
    .select("id")
    .eq("id", sessionId);
  const { data: anonymousSessions, error: anonymousSessionError } = await anonymousClient
    .from("flashcard_review_sessions")
    .select("id")
    .eq("id", sessionId);
  check(!otherSessionError && otherSessions.length === 0, "another user cannot read the owner's session");
  check(
    Boolean(anonymousSessionError) || anonymousSessions.length === 0,
    "anonymous clients cannot read review sessions",
  );

  const { error: schedulerUpdateError } = await ownerClient
    .from("flashcards")
    .update({ due: new Date(0).toISOString() })
    .eq("id", ownerCards[0].id);
  check(Boolean(schedulerUpdateError), "ordinary owners cannot update scheduler columns");
  const { data: contentCard, error: contentUpdateError } = await ownerClient
    .from("flashcards")
    .update({ front: "Owner content update" })
    .eq("id", ownerCards[0].id)
    .select("id, updated_at")
    .single();
  check(!contentUpdateError && contentCard?.id === ownerCards[0].id, "ordinary owners can update card content");

  const { error: directRpcError } = await ownerClient.rpc("get_or_create_review_session", {
    p_user_id: ownerId,
    p_cutoff: cutoff.toISOString(),
  });
  check(Boolean(directRpcError), "ordinary authenticated clients cannot invoke the protected session RPC");
  const { error: forgedMembershipError } = await ownerClient.from("flashcard_review_session_cards").insert({
    session_id: sessionId,
    user_id: ownerId,
    flashcard_id: otherCard.id,
    ordinal: 99,
  });
  check(Boolean(forgedMembershipError), "ordinary clients cannot forge review-session membership");

  const reviewedAt = new Date();
  const nextDue = new Date(reviewedAt.getTime() + 10 * 86_400_000).toISOString();
  const requestId = randomUUID();
  const reviewArgs = {
    p_user_id: ownerId,
    p_session_id: sessionId,
    p_request_id: requestId,
    p_flashcard_id: ownerCards[0].id,
    p_rating: 3,
    p_expected_schedule_version: 0,
    p_reviewed_at: reviewedAt.toISOString(),
    p_post_state: postState(nextDue),
    p_result: canonicalResult({ requestId, sessionId, cardId: ownerCards[0].id, rating: 3, nextDue }),
  };
  const { data: applied, error: applyError } = await fixtureClient.rpc("apply_flashcard_review", reviewArgs);
  check(!applyError && applied?.outcome === "applied", "one accepted review intent is applied");
  check(Number.isFinite(Date.parse(applied.reviewed_at)), "the canonical review result contains an ISO timestamp");
  check(
    applied.schedulerVersion === "5.4.2" && applied.configVersion === "fsrs-v6-defaults-v1",
    "the result audits scheduler and configuration versions",
  );

  const retryTime = new Date(reviewedAt.getTime() + 60_000).toISOString();
  const { data: replayed, error: replayError } = await fixtureClient.rpc("apply_flashcard_review", {
    ...reviewArgs,
    p_reviewed_at: retryTime,
    p_post_state: { due: "2035-01-01T00:00:00.000Z" },
    p_result: { changed: "derived retry output must be ignored" },
  });
  check(!replayError && replayed?.outcome === "replayed", "the same stable request intent is replayed");
  check(
    Date.parse(replayed.reviewed_at) === reviewedAt.getTime() && replayed.nextDue === nextDue,
    "replay returns the first canonical timestamp and post-state result",
  );

  const { error: changedIntentError } = await fixtureClient.rpc("apply_flashcard_review", {
    ...reviewArgs,
    p_rating: 4,
  });
  check(
    changedIntentError?.message.includes("review_request_conflict"),
    "request UUID reuse with changed intent conflicts",
  );
  const staleRequestId = randomUUID();
  const { data: staleResult, error: staleError } = await fixtureClient.rpc("apply_flashcard_review", {
    ...reviewArgs,
    p_request_id: staleRequestId,
    p_flashcard_id: ownerCards[1].id,
    p_expected_schedule_version: 9,
  });
  check(Boolean(staleError) || staleResult === null, "a stale schedule version returns no accepted result");
  const [{ data: staleCard }, { data: staleLogs }] = await Promise.all([
    fixtureClient.from("flashcards").select("schedule_version").eq("id", ownerCards[1].id).single(),
    fixtureClient.from("flashcard_review_logs").select("id").eq("request_id", staleRequestId),
  ]);
  check(
    staleCard.schedule_version === 0 && staleLogs.length === 0,
    "the rejected stale review leaves the card and history unchanged",
  );

  const [{ data: storedCard }, { data: storedMember }, { data: storedSession }, { data: storedLogs }] =
    await Promise.all([
      fixtureClient.from("flashcards").select("schedule_version, updated_at").eq("id", ownerCards[0].id).single(),
      fixtureClient
        .from("flashcard_review_session_cards")
        .select("state, review_count")
        .eq("session_id", sessionId)
        .eq("flashcard_id", ownerCards[0].id)
        .single(),
      fixtureClient.from("flashcard_review_sessions").select("reviewed_count, good_count").eq("id", sessionId).single(),
      fixtureClient.from("flashcard_review_logs").select("id, reviewed_at, post_state").eq("request_id", requestId),
    ]);
  check(
    storedCard.schedule_version === 1 &&
      storedMember.review_count === 1 &&
      storedMember.state === "deferred" &&
      storedSession.reviewed_count === 1 &&
      storedSession.good_count === 1 &&
      storedLogs.length === 1,
    "card, log, membership, and session summary advance atomically exactly once",
  );

  const concurrentTrialCount = 3;
  for (let trial = 0; trial < concurrentTrialCount; trial += 1) {
    const card = ownerCards[trial + 2];
    const trialReviewedAt = new Date(reviewedAt.getTime() + (trial + 1) * 1_000);
    const trialNextDue = new Date(trialReviewedAt.getTime() + 10 * 86_400_000).toISOString();
    const trialRequestId = randomUUID();
    const sharedReviewArgs = {
      p_user_id: ownerId,
      p_session_id: sessionId,
      p_request_id: trialRequestId,
      p_flashcard_id: card.id,
      p_rating: 3,
      p_expected_schedule_version: 0,
      p_reviewed_at: trialReviewedAt.toISOString(),
      p_post_state: postState(trialNextDue),
      p_result: canonicalResult({
        requestId: trialRequestId,
        sessionId,
        cardId: card.id,
        rating: 3,
        nextDue: trialNextDue,
      }),
    };

    // This is practical scheduling evidence through PostgREST. The pgTAP function-order check
    // separately proves that request-scoped serialization precedes replay detection.
    const concurrentResults = await Promise.all([
      fixtureClient.rpc("apply_flashcard_review", sharedReviewArgs),
      fixtureClient.rpc("apply_flashcard_review", sharedReviewArgs),
    ]);
    check(
      concurrentResults.every(({ error }) => !error),
      `concurrent review trial ${trial + 1} returns two accepted results`,
    );
    const outcomes = concurrentResults.map(({ data }) => data.outcome).sort();
    checkDeepEqual(
      outcomes,
      ["applied", "replayed"],
      `concurrent review trial ${trial + 1} yields one application and one canonical replay`,
    );
    checkDeepEqual(
      canonicalFields(concurrentResults[0].data),
      canonicalFields(concurrentResults[1].data),
      `concurrent review trial ${trial + 1} returns matching canonical fields`,
    );

    const [{ data: trialCard }, { data: trialMember }, { data: trialSession }, { data: trialLogs }] = await Promise.all(
      [
        fixtureClient.from("flashcards").select("schedule_version").eq("id", card.id).single(),
        fixtureClient
          .from("flashcard_review_session_cards")
          .select("state, review_count")
          .eq("session_id", sessionId)
          .eq("flashcard_id", card.id)
          .single(),
        fixtureClient
          .from("flashcard_review_sessions")
          .select("reviewed_count, good_count")
          .eq("id", sessionId)
          .single(),
        fixtureClient.from("flashcard_review_logs").select("id").eq("request_id", trialRequestId),
      ],
    );
    check(
      trialCard.schedule_version === 1 &&
        trialMember.review_count === 1 &&
        trialMember.state === "deferred" &&
        trialSession.reviewed_count === trial + 2 &&
        trialSession.good_count === trial + 2 &&
        trialLogs.length === 1,
      `concurrent review trial ${trial + 1} mutates card, member, session, and log exactly once`,
    );
  }

  check(storedCard.updated_at === contentCard.updated_at, "review scheduling preserves an already-open content token");

  const { data: editedAfterReview, error: editAfterReviewError } = await ownerClient
    .from("flashcards")
    .update({ back: "Edited after review" })
    .eq("id", ownerCards[0].id)
    .eq("updated_at", contentCard.updated_at)
    .select("updated_at")
    .single();
  check(
    !editAfterReviewError && editedAfterReview.updated_at !== contentCard.updated_at,
    "the open content edit succeeds after review and advances its own token",
  );

  const { data: ownerLogs, error: ownerLogsError } = await ownerClient
    .from("flashcard_review_logs")
    .select("request_id")
    .eq("request_id", requestId);
  const { data: otherLogs, error: otherLogsError } = await otherClient
    .from("flashcard_review_logs")
    .select("request_id")
    .eq("request_id", requestId);
  check(!ownerLogsError && ownerLogs.length === 1, "owner reads their review history through the ordinary client");
  check(!otherLogsError && otherLogs.length === 0, "another user cannot read the owner's review history");

  const { error: deleteError } = await ownerClient.from("flashcards").delete().eq("id", ownerCards[0].id);
  check(!deleteError, "owner deletes the reviewed card through the ordinary client");
  const [{ data: remainingLogs }, { data: remainingMembership }] = await Promise.all([
    fixtureClient.from("flashcard_review_logs").select("id").eq("request_id", requestId),
    fixtureClient.from("flashcard_review_session_cards").select("flashcard_id").eq("flashcard_id", ownerCards[0].id),
  ]);
  check(
    remainingLogs.length === 0 && remainingMembership.length === 0,
    "card deletion cascades log and membership rows",
  );

  const expiredCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1_000);
  const expiredAt = new Date(expiredCreatedAt.getTime() + 24 * 60 * 60 * 1_000);
  const { error: ageSessionError } = await fixtureClient
    .from("flashcard_review_sessions")
    .update({ created_at: expiredCreatedAt.toISOString(), expires_at: expiredAt.toISOString() })
    .eq("id", sessionId);
  check(!ageSessionError, "fixture setup ages the active session beyond its 24-hour lifetime");
  const { data: replacement, error: replacementError } = await fixtureClient.rpc("get_or_create_review_session", {
    p_user_id: ownerId,
    p_cutoff: new Date().toISOString(),
  });
  const { data: oldSession } = await fixtureClient
    .from("flashcard_review_sessions")
    .select("status")
    .eq("id", sessionId)
    .single();
  check(
    !replacementError && replacement.id !== sessionId && oldSession.status === "expired",
    "expiry is persisted before a replacement session is created",
  );

  const rateSource = readFileSync("src/pages/api/review/rate.ts", "utf8");
  const sessionSource = readFileSync("src/pages/api/review/session.ts", "utf8");
  const uiSource = readFileSync("src/components/review/SpacedRepetitionSession.tsx", "utf8");
  for (const mode of ["rating_failure", "rating_lost_response", "rating_stale_transition"]) {
    check(rateSource.includes(mode), `rating endpoint exposes the development-only ${mode} mode`);
  }
  check(sessionSource.includes("session_failure"), "session endpoint exposes the development-only failure mode");
  check(
    uiSource.includes("setPending(payload)") &&
      uiSource.includes("Retry same rating") &&
      uiSource.includes("setSession(body.result.session)"),
    "the UI retains ambiguous intent and advances only from a confirmed canonical result",
  );

  console.log("Spaced repetition verification passed. Run `npm run db:reset` to remove transient fixtures.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Spaced repetition verification failed.");
  process.exitCode = 1;
});
