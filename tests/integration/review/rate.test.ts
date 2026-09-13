import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { acquireReviewSessionMock, createAdminClientMock, readReviewSessionMock, scheduleReviewMock } = vi.hoisted(
  () => ({
    acquireReviewSessionMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    readReviewSessionMock: vi.fn(),
    scheduleReviewMock: vi.fn(),
  }),
);

vi.mock("@/lib/fsrs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/fsrs")>();
  scheduleReviewMock.mockImplementation(original.scheduleReview);
  return { ...original, scheduleReview: scheduleReviewMock };
});
vi.mock("@/lib/review-session", () => ({
  acquireReviewSession: acquireReviewSessionMock,
  readReviewSession: readReviewSessionMock,
}));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: createAdminClientMock }));

import { POST } from "@/pages/api/review/rate";
import type { ReviewSessionDto, ScheduledFlashcardRow } from "@/lib/spaced-repetition";

const NOW = new Date("2026-09-14T10:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const CARD_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const INPUT = {
  requestId: REQUEST_ID,
  sessionId: SESSION_ID,
  cardId: CARD_ID,
  rating: 3 as const,
  expectedScheduleVersion: 0,
};
const CARD: ScheduledFlashcardRow = {
  id: CARD_ID,
  user_id: USER_ID,
  front: "Literal handler fixture",
  back: "Its scheduler output is asserted independently.",
  created_at: "2026-09-13T10:00:00.000Z",
  updated_at: "2026-09-13T10:00:00.000Z",
  due: "2026-09-14T10:00:00.000Z",
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  last_review: null,
  schedule_version: 0,
  scheduler_version: "5.4.2",
  config_version: "fsrs-v6-defaults-v1",
};
const SESSION: ReviewSessionDto = {
  id: SESSION_ID,
  status: "active",
  cutoff: "2026-09-14T10:00:00.000Z",
  expiresAt: "2026-09-15T10:00:00.000Z",
  cards: [
    {
      id: CARD_ID,
      front: CARD.front,
      back: CARD.back,
      due: "2026-09-14T10:10:00.000Z",
      disposition: "deferred",
      ordinal: 1,
      reviewCount: 1,
      scheduleVersion: 1,
    },
  ],
  summary: {
    totalCount: 1,
    remainingCount: 0,
    reviewedCount: 1,
    againCount: 0,
    hardCount: 0,
    goodCount: 1,
    easyCount: 0,
    deferredCount: 1,
  },
};
const SCHEDULED = {
  postState: {
    due: "2026-09-14T10:10:00.000Z",
    stability: 2.3065,
    difficulty: 2.11810397,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 1,
    reps: 1,
    lapses: 0,
    state: 1,
    last_review: "2026-09-14T10:00:00.000Z",
  },
  nextDue: "2026-09-14T10:10:00.000Z",
};

interface DatabaseResult {
  data: unknown;
  error: null | { message: string };
}

function query(result: DatabaseResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

function adminClient(
  options: {
    replay?: boolean;
    session?: DatabaseResult;
    member?: DatabaseResult;
    card?: DatabaseResult;
    rpc?: DatabaseResult | Error;
  } = {},
) {
  const queues: Record<string, ReturnType<typeof query>[]> = {
    flashcard_review_logs: [query({ data: options.replay ? { request_id: REQUEST_ID } : null, error: null })],
    flashcard_review_sessions: [
      query(
        options.session ?? { data: { id: SESSION_ID, status: "active", expires_at: SESSION.expiresAt }, error: null },
      ),
    ],
    flashcard_review_session_cards: [
      query(options.member ?? { data: { state: "ready", next_due: null }, error: null }),
    ],
    flashcards: [query(options.card ?? { data: CARD, error: null })],
  };
  const from = vi.fn((table: string) => {
    const next = queues[table].shift();
    if (!next) throw new Error(`Unexpected table read: ${table}`);
    return next;
  });
  const defaultRpc = {
    data: {
      outcome: options.replay ? "replayed" : "applied",
      requestId: REQUEST_ID,
      sessionId: SESSION_ID,
      cardId: CARD_ID,
      reviewed_at: NOW.toISOString(),
      nextDue: SCHEDULED.nextDue,
      schedule_version: 1,
      disposition: "deferred",
    },
    error: null,
  };
  const rpc = vi.fn(() =>
    options.rpc instanceof Error ? Promise.reject(options.rpc) : Promise.resolve(options.rpc ?? defaultRpc),
  );
  return { client: { from, rpc }, from, rpc };
}

function request(
  body: string | object = INPUT,
  options: { authenticated?: boolean; contentType?: string; origin?: string } = {},
): Promise<Response> {
  const apiRequest = new Request("http://localhost/api/review/rate", {
    method: "POST",
    headers: {
      "Content-Type": options.contentType ?? "application/json",
      Origin: options.origin ?? "http://localhost",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST({
    request: apiRequest,
    locals: { user: options.authenticated === false ? null : { id: USER_ID } },
  } as unknown as Parameters<typeof POST>[0]);
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ error: { code } });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  createAdminClientMock.mockReset();
  acquireReviewSessionMock.mockReset();
  readReviewSessionMock.mockReset();
  scheduleReviewMock.mockClear();
  acquireReviewSessionMock.mockResolvedValue(SESSION);
  readReviewSessionMock.mockResolvedValue(SESSION);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/review/rate", () => {
  it.each([
    ["cross-origin", INPUT, { origin: "https://attacker.example" }, 403, "invalid_origin"],
    ["unauthenticated", INPUT, { authenticated: false }, 401, "unauthenticated"],
    ["wrong content type", INPUT, { contentType: "text/plain" }, 415, "invalid_json"],
    ["malformed JSON", "{", {}, 400, "invalid_json"],
    ["invalid request", { ...INPUT, rating: 5 }, {}, 422, "invalid_rating_request"],
  ])("rejects %s before creating the admin client", async (_label, body, options, status, code) => {
    await expectError(await request(body, options), status, code);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns service unavailable when server credentials cannot create an admin client", async () => {
    createAdminClientMock.mockReturnValue(null);

    await expectError(await request(), 503, "review_unavailable");
  });

  it("passes the real literal scheduler transition to the RPC and returns the authoritative reread", async () => {
    const fake = adminClient();
    createAdminClientMock.mockReturnValue(fake.client);

    const response = await request();

    expect(response.status).toBe(200);
    expect(scheduleReviewMock).toHaveBeenCalledWith(CARD, NOW, 3);
    expect(fake.rpc).toHaveBeenCalledWith("apply_flashcard_review", {
      p_user_id: USER_ID,
      p_session_id: SESSION_ID,
      p_request_id: REQUEST_ID,
      p_flashcard_id: CARD_ID,
      p_rating: 3,
      p_expected_schedule_version: 0,
      p_reviewed_at: "2026-09-14T10:00:00.000Z",
      p_post_state: SCHEDULED.postState,
      p_result: {
        requestId: REQUEST_ID,
        sessionId: SESSION_ID,
        cardId: CARD_ID,
        rating: 3,
        nextDue: "2026-09-14T10:10:00.000Z",
        disposition: "deferred",
        schedulerVersion: "5.4.2",
        configVersion: "fsrs-v6-defaults-v1",
      },
    });
    expect(readReviewSessionMock).toHaveBeenCalledWith(fake.client, USER_ID, SESSION_ID, NOW);
    await expect(response.json()).resolves.toEqual({
      result: {
        outcome: "applied",
        requestId: REQUEST_ID,
        sessionId: SESSION_ID,
        cardId: CARD_ID,
        rating: 3,
        reviewedAt: "2026-09-14T10:00:00.000Z",
        nextDue: "2026-09-14T10:10:00.000Z",
        scheduleVersion: 1,
        disposition: "deferred",
        session: SESSION,
      },
    });
  });

  it("replays an existing stable request without scheduling a new transition", async () => {
    const fake = adminClient({ replay: true });
    createAdminClientMock.mockReturnValue(fake.client);

    const response = await request();

    expect(scheduleReviewMock).not.toHaveBeenCalled();
    expect(fake.rpc).toHaveBeenCalledWith("apply_flashcard_review", {
      p_user_id: USER_ID,
      p_session_id: SESSION_ID,
      p_request_id: REQUEST_ID,
      p_flashcard_id: CARD_ID,
      p_rating: 3,
      p_expected_schedule_version: 0,
      p_reviewed_at: NOW.toISOString(),
      p_post_state: {},
      p_result: {},
    });
    await expect(response.json()).resolves.toMatchObject({ result: { outcome: "replayed", session: SESSION } });
  });

  it.each([
    [
      "changed session",
      { session: { data: { id: SESSION_ID, status: "completed", expires_at: SESSION.expiresAt }, error: null } },
      "review_session_changed",
    ],
    [
      "completed member",
      { member: { data: { state: "completed", next_due: null }, error: null } },
      "review_progress_changed",
    ],
    ["stale version", { card: { data: { ...CARD, schedule_version: 1 }, error: null } }, "stale_schedule_version"],
    [
      "not-due card",
      { card: { data: { ...CARD, due: "2026-09-14T10:00:00.001Z" }, error: null } },
      "review_card_not_due",
    ],
  ])("maps the %s precondition to an authoritative conflict", async (_label, overrides, code) => {
    const fake = adminClient(overrides);
    createAdminClientMock.mockReturnValue(fake.client);

    const response = await request();

    await expectError(response, 409, code);
    expect(acquireReviewSessionMock).toHaveBeenCalledWith(fake.client, USER_ID, NOW);
    expect(scheduleReviewMock).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("maps a missing session member to a non-disclosing unavailable response", async () => {
    const fake = adminClient({ member: { data: null, error: null } });
    createAdminClientMock.mockReturnValue(fake.client);

    await expectError(await request(), 404, "review_card_unavailable");
  });

  it.each([
    ["review_request_conflict", 409, "review_request_conflict"],
    ["stale_schedule_version", 409, "stale_schedule_version"],
    ["review_session_unavailable", 409, "review_progress_changed"],
    ["review_card_not_in_session", 409, "review_progress_changed"],
    ["review_card_not_due", 409, "review_card_not_due"],
    ["review_card_unavailable", 404, "review_card_unavailable"],
    ["invalid_post_state", 422, "invalid_rating_request"],
    ["unexpected_database_failure", 503, "review_ambiguous"],
  ])("maps RPC error %s to %i %s", async (message, status, code) => {
    const fake = adminClient({ rpc: { data: null, error: { message } } });
    createAdminClientMock.mockReturnValue(fake.client);

    await expectError(await request(), status, code);
  });

  it.each([
    ["2026-09-14T10:00:00.000Z", "ready"],
    ["2026-09-14T10:01:00.000Z", "waiting"],
    ["2026-09-14T10:01:00.001Z", "deferred"],
  ] as const)("classifies next due %s as %s", async (nextDue, disposition) => {
    scheduleReviewMock.mockImplementationOnce(() => ({
      postState: { ...SCHEDULED.postState, due: nextDue },
      nextDue,
    }));
    const fake = adminClient({
      rpc: {
        data: {
          outcome: "applied",
          requestId: REQUEST_ID,
          sessionId: SESSION_ID,
          cardId: CARD_ID,
          reviewed_at: NOW.toISOString(),
          nextDue,
          schedule_version: 1,
          disposition,
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(fake.client);

    const response = await request();

    expect(response.status).toBe(200);
    expect(fake.rpc).toHaveBeenCalledOnce();
    expect(fake.rpc.mock.calls[0]?.[0]).toBe("apply_flashcard_review");
    const rpcArguments = fake.rpc.mock.calls[0]?.[1] as
      | { p_result: { nextDue: string; disposition: string } }
      | undefined;
    expect(rpcArguments?.p_result).toMatchObject({ nextDue, disposition });
  });

  it("rejects a structurally invalid RPC result as ambiguous", async () => {
    const fake = adminClient({ rpc: { data: { outcome: "applied" }, error: null } });
    createAdminClientMock.mockReturnValue(fake.client);

    await expectError(await request(), 503, "review_ambiguous");
    expect(readReviewSessionMock).not.toHaveBeenCalled();
  });

  it.each([
    ["failed replay lookup", { replayLookupFailure: true }],
    ["thrown RPC transport", { rpcFailure: true }],
  ])("maps %s to an ambiguous response", async (_label, mode) => {
    const fake = adminClient({ rpc: mode.rpcFailure ? new Error("connection lost") : undefined });
    if (mode.replayLookupFailure) {
      fake.client.from = vi.fn(() => {
        throw new Error("lookup failed");
      });
    }
    createAdminClientMock.mockReturnValue(fake.client);

    await expectError(await request(), 503, "review_ambiguous");
  });
});
