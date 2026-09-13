import { describe, expect, it } from "vitest";

import { databaseRowToCard, scheduleReview, schedulerPolicy, type PersistedSchedulerState } from "@/lib/fsrs";
import type { ReviewRating, ScheduledFlashcardRow } from "@/lib/spaced-repetition";

const REVIEWED_AT = new Date("2026-09-14T10:00:00.000Z");
const EMPTY_SCHEDULED_ROW: ScheduledFlashcardRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  front: "What is a literal scheduler fixture?",
  back: "A persisted row whose expected transitions are written independently.",
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

const FIRST_TRANSITIONS: Record<ReviewRating, PersistedSchedulerState> = {
  1: {
    due: "2026-09-14T10:01:00.000Z",
    stability: 0.212,
    difficulty: 6.4133,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: 1,
    last_review: "2026-09-14T10:00:00.000Z",
  },
  2: {
    due: "2026-09-14T10:06:00.000Z",
    stability: 1.2931,
    difficulty: 5.11217071,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: 1,
    last_review: "2026-09-14T10:00:00.000Z",
  },
  3: {
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
  4: {
    due: "2026-09-22T10:00:00.000Z",
    stability: 8.2956,
    difficulty: 1,
    elapsed_days: 0,
    scheduled_days: 8,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    last_review: "2026-09-14T10:00:00.000Z",
  },
};

describe("FSRS database adapter", () => {
  it("exports the pinned application scheduler policy", () => {
    expect(schedulerPolicy).toEqual({
      packageVersion: "5.4.2",
      configVersion: "fsrs-v6-defaults-v1",
      requestRetention: 0.9,
      maximumInterval: 36_500,
      enableFuzz: false,
      enableShortTerm: true,
      learningSteps: ["1m", "10m"],
      relearningSteps: ["10m"],
    });
  });

  it("maps canonical database timestamps and null last-review state into scheduler dates", () => {
    const empty = databaseRowToCard(EMPTY_SCHEDULED_ROW);
    const reviewed = databaseRowToCard({
      ...EMPTY_SCHEDULED_ROW,
      due: "2026-09-14T10:10:00.000+00:00",
      last_review: "2026-09-14T10:00:00.000+00:00",
    });

    expect(empty.due).toEqual(new Date("2026-09-14T10:00:00.000Z"));
    expect(empty.last_review).toBeUndefined();
    expect(reviewed.due).toEqual(new Date("2026-09-14T10:10:00.000Z"));
    expect(reviewed.last_review).toEqual(new Date("2026-09-14T10:00:00.000Z"));
  });

  it.each([1, 2, 3, 4] as const)("returns the literal persisted transition for rating %i", (rating) => {
    const result = scheduleReview(EMPTY_SCHEDULED_ROW, REVIEWED_AT, rating);

    expect(result).toEqual({
      postState: FIRST_TRANSITIONS[rating],
      nextDue: FIRST_TRANSITIONS[rating].due,
    });
  });

  it("schedules a second transition from a literal persisted first-transition row", () => {
    const firstGoodRow: ScheduledFlashcardRow = {
      ...EMPTY_SCHEDULED_ROW,
      ...FIRST_TRANSITIONS[3],
      schedule_version: 1,
      updated_at: "2026-09-14T10:00:00.000Z",
    };

    expect(scheduleReview(firstGoodRow, new Date("2026-09-14T10:10:00.000Z"), 3)).toEqual({
      postState: {
        due: "2026-09-16T10:10:00.000Z",
        stability: 2.3065,
        difficulty: 2.11121424,
        elapsed_days: 0,
        scheduled_days: 2,
        learning_steps: 0,
        reps: 2,
        lapses: 0,
        state: 2,
        last_review: "2026-09-14T10:10:00.000Z",
      },
      nextDue: "2026-09-16T10:10:00.000Z",
    });
  });
});
