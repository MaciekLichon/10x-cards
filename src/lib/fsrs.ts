import { fsrs, generatorParameters, type Card } from "ts-fsrs";
import {
  SCHEDULER_CONFIG_VERSION,
  SCHEDULER_PACKAGE_VERSION,
  canonicalIso,
  type ReviewRating,
  type ScheduledFlashcardRow,
} from "@/lib/spaced-repetition";

const parameters = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 36_500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});

const scheduler = fsrs(parameters);

export interface PersistedSchedulerState extends Record<string, string | number | null> {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

export interface ScheduledReview {
  postState: PersistedSchedulerState;
  nextDue: string;
}

export const schedulerPolicy = Object.freeze({
  packageVersion: SCHEDULER_PACKAGE_VERSION,
  configVersion: SCHEDULER_CONFIG_VERSION,
  requestRetention: parameters.request_retention,
  maximumInterval: parameters.maximum_interval,
  enableFuzz: parameters.enable_fuzz,
  enableShortTerm: parameters.enable_short_term,
  learningSteps: [...parameters.learning_steps],
  relearningSteps: [...parameters.relearning_steps],
});

export function databaseRowToCard(row: ScheduledFlashcardRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

function cardToPersistedState(card: Card): PersistedSchedulerState {
  return {
    due: canonicalIso(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    // The pinned 5.4.2 database contract still requires this field.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? canonicalIso(card.last_review) : null,
  };
}

export function scheduleReview(row: ScheduledFlashcardRow, reviewedAt: Date, rating: ReviewRating): ScheduledReview {
  const result = scheduler.next(databaseRowToCard(row), reviewedAt, rating);
  const postState = cardToPersistedState(result.card);
  return { postState, nextDue: postState.due };
}
