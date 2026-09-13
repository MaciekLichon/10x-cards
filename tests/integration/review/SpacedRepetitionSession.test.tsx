// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import SpacedRepetitionSession from "@/components/review/SpacedRepetitionSession";
import type { RateReviewResultDto, ReviewCardDto, ReviewSessionDto } from "@/lib/spaced-repetition";

import "../../setup-dom";

const NOW = new Date("2026-09-13T12:00:00.000Z");
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const FIRST_CARD_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_CARD_ID = "44444444-4444-4444-8444-444444444444";

const FIRST_CARD: ReviewCardDto = {
  id: FIRST_CARD_ID,
  front: "What survives an uncertain response?",
  back: "The original rating intent.",
  due: "2026-09-13T11:00:00.000Z",
  disposition: "ready",
  ordinal: 0,
  reviewCount: 0,
  scheduleVersion: 0,
};
const SECOND_CARD: ReviewCardDto = {
  id: SECOND_CARD_ID,
  front: "What confirms review progress?",
  back: "The canonical server session.",
  due: "2026-09-13T11:30:00.000Z",
  disposition: "ready",
  ordinal: 1,
  reviewCount: 0,
  scheduleVersion: 0,
};
const INITIAL_SESSION: ReviewSessionDto = {
  id: SESSION_ID,
  status: "active",
  cutoff: "2026-09-13T12:00:00.000Z",
  expiresAt: "2026-09-14T12:00:00.000Z",
  cards: [FIRST_CARD, SECOND_CARD],
  summary: {
    totalCount: 2,
    remainingCount: 2,
    reviewedCount: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
    deferredCount: 0,
  },
};
const CONFIRMED_SESSION: ReviewSessionDto = {
  ...INITIAL_SESSION,
  cards: [{ ...FIRST_CARD, disposition: "deferred", reviewCount: 1, scheduleVersion: 1 }, SECOND_CARD],
  summary: {
    ...INITIAL_SESSION.summary,
    remainingCount: 1,
    reviewedCount: 1,
    goodCount: 1,
    deferredCount: 1,
  },
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function sessionResponse(session: ReviewSessionDto): Response {
  return Response.json({ session });
}

function ratingResponse(session = CONFIRMED_SESSION): Response {
  const result: RateReviewResultDto = {
    outcome: "applied",
    requestId: REQUEST_ID,
    sessionId: SESSION_ID,
    cardId: FIRST_CARD_ID,
    rating: 3,
    reviewedAt: NOW.toISOString(),
    nextDue: "2026-09-20T12:00:00.000Z",
    scheduleVersion: 1,
    disposition: "deferred",
    session,
  };
  return Response.json({ result });
}

function conflictResponse(session?: ReviewSessionDto): Response {
  return Response.json({ error: { code: "review_session_changed" }, session }, { status: 409 });
}

function errorResponse(status: number, code: string, message?: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function stubFetch(...results: (Response | Promise<Response> | Error)[]): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>();
  for (const result of results) {
    if (result instanceof Error) fetchMock.mockRejectedValueOnce(result);
    else fetchMock.mockImplementationOnce(() => Promise.resolve(result));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function establishGlobals(fakeTime = false): void {
  if (fakeTime) vi.setSystemTime(NOW);
  else vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => REQUEST_ID) });
}

async function renderReadySession(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  establishGlobals();
  const user = userEvent.setup();
  render(<SpacedRepetitionSession />);
  expect(await screen.findByText(FIRST_CARD.front)).toBeTruthy();
  expect(fetchMock.mock.calls[0]).toEqual(["/api/review/session"]);
  return user;
}

async function submitGoodRating(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Reveal answer" }));
  await user.click(screen.getByRole("button", { name: /Good/ }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SpacedRepetitionSession continuity", () => {
  it("keeps the original card and progress until the canonical result session arrives", async () => {
    const pending = deferred<Response>();
    const fetchMock = stubFetch(sessionResponse(INITIAL_SESSION), pending.promise);
    const user = await renderReadySession(fetchMock);

    await submitGoodRating(user);

    expect(screen.getByText(FIRST_CARD.front)).toBeTruthy();
    expect(screen.getByText("2 of 2 remaining")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Saving your rating");
    expect(screen.queryByText(SECOND_CARD.front)).toBeNull();

    pending.resolve(ratingResponse());

    expect(await screen.findByText(SECOND_CARD.front)).toBeTruthy();
    expect(screen.getByText("1 of 2 remaining")).toBeTruthy();
    expect(screen.getByText("Good saved. Progress confirmed.")).toBeTruthy();
  });

  it.each([
    ["ambiguous server response", errorResponse(503, "review_ambiguous")],
    ["network failure", new Error("connection lost")],
  ])("retries byte-equivalent rating intent after an %s", async (_label, failure) => {
    const fetchMock = stubFetch(sessionResponse(INITIAL_SESSION), failure, ratingResponse());
    const user = await renderReadySession(fetchMock);

    await submitGoodRating(user);
    const retry = await screen.findByRole("button", { name: "Retry same rating" });
    expect(screen.getByText(FIRST_CARD.front)).toBeTruthy();
    expect(screen.getByText("2 of 2 remaining")).toBeTruthy();
    const firstRatingBody = fetchMock.mock.calls[1]?.[1]?.body;
    if (typeof firstRatingBody !== "string") throw new Error("Expected the rating request body to be JSON text.");

    await user.click(retry);

    expect(await screen.findByText(SECOND_CARD.front)).toBeTruthy();
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(firstRatingBody);
    expect(JSON.parse(firstRatingBody)).toEqual({
      requestId: REQUEST_ID,
      sessionId: SESSION_ID,
      cardId: FIRST_CARD_ID,
      rating: 3,
      expectedScheduleVersion: 0,
    });
  });

  it("installs an authoritative session embedded in a 409 response without reloading", async () => {
    const fetchMock = stubFetch(sessionResponse(INITIAL_SESSION), conflictResponse(CONFIRMED_SESSION));
    const user = await renderReadySession(fetchMock);

    await submitGoodRating(user);

    expect(await screen.findByText(SECOND_CARD.front)).toBeTruthy();
    expect(screen.getByText("Progress changed in another tab. The latest session has been restored.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("performs exactly one read-only reload when a 409 has no embedded session", async () => {
    const fetchMock = stubFetch(
      sessionResponse(INITIAL_SESSION),
      conflictResponse(),
      sessionResponse(CONFIRMED_SESSION),
    );
    const user = await renderReadySession(fetchMock);

    await submitGoodRating(user);

    expect(await screen.findByText(SECOND_CARD.front)).toBeTruthy();
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual(["GET", "POST", "GET"]);
  });

  it("keeps stale rating controls disabled and retries only the failed authoritative reload", async () => {
    const fetchMock = stubFetch(
      sessionResponse(INITIAL_SESSION),
      conflictResponse(),
      errorResponse(503, "session_failure", "Authoritative session unavailable."),
      sessionResponse(CONFIRMED_SESSION),
    );
    const user = await renderReadySession(fetchMock);

    await submitGoodRating(user);

    expect((await screen.findByRole("alert")).textContent).toContain("Authoritative session unavailable.");
    expect(screen.getByRole("button", { name: /Good/ }).closest("fieldset")?.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Progress changed in another tab. The latest session has been restored.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText(SECOND_CARD.front)).toBeTruthy();
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual(["GET", "POST", "GET", "GET"]);
  });

  it("reloads authoritatively when the only waiting card reaches its due instant", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const waitingSession: ReviewSessionDto = {
      ...INITIAL_SESSION,
      cards: [
        {
          ...FIRST_CARD,
          due: "2026-09-13T12:00:01.000Z",
          disposition: "waiting",
        },
      ],
      summary: { ...INITIAL_SESSION.summary, totalCount: 1, remainingCount: 1 },
    };
    const readySession: ReviewSessionDto = {
      ...waitingSession,
      cards: [{ ...waitingSession.cards[0], disposition: "ready" }],
    };
    const fetchMock = stubFetch(sessionResponse(waitingSession), sessionResponse(readySession));

    establishGlobals(true);
    render(<SpacedRepetitionSession />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("status").textContent).toContain("Ready in 1 second");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.resolve();
    });

    expect(screen.getByText(FIRST_CARD.front)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls).toEqual([["/api/review/session"], ["/api/review/session"]]);
  });
});
