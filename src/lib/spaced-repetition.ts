import type { Json, Tables } from "@/types/database.types";

export const REVIEW_SESSION_LIMIT = 20;
export const REVIEW_WAIT_THRESHOLD_SECONDS = 60;
export const REVIEW_SESSION_EXPIRY_HOURS = 24;
export const SCHEDULER_PACKAGE_VERSION = "5.4.2";
export const SCHEDULER_CONFIG_VERSION = "fsrs-v6-defaults-v1";

export type ReviewRating = 1 | 2 | 3 | 4;
export type ReviewCardDisposition = "ready" | "waiting" | "deferred" | "completed";

export interface ReviewCardDto {
  id: string;
  front: string;
  back: string;
  due: string;
  disposition: ReviewCardDisposition;
  ordinal: number;
  reviewCount: number;
  scheduleVersion: number;
}

export interface ReviewSummaryDto {
  totalCount: number;
  remainingCount: number;
  reviewedCount: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  deferredCount: number;
}

export interface ReviewSessionDto {
  id: string;
  status: "empty" | "active" | "completed";
  cutoff: string;
  expiresAt: string;
  cards: ReviewCardDto[];
  summary: ReviewSummaryDto;
}

export interface RateReviewInput {
  requestId: string;
  sessionId: string;
  cardId: string;
  rating: ReviewRating;
  expectedScheduleVersion: number;
}

export interface RateReviewResultDto {
  outcome: "applied" | "replayed";
  requestId: string;
  sessionId: string;
  cardId: string;
  rating: ReviewRating;
  reviewedAt: string;
  nextDue: string;
  scheduleVersion: number;
  disposition: ReviewCardDisposition;
  session: ReviewSessionDto;
}

export type ParseResult<T> = { success: true; data: T } | { success: false };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function parseCanonicalUuid(value: unknown): ParseResult<string> {
  return typeof value === "string" && UUID_PATTERN.test(value) ? { success: true, data: value } : { success: false };
}

export function parseReviewRating(value: unknown): ParseResult<ReviewRating> {
  return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 4
    ? { success: true, data: value as ReviewRating }
    : { success: false };
}

export function parseRateReviewInput(value: unknown): ParseResult<RateReviewInput> {
  if (typeof value !== "object" || value === null) return { success: false };
  const candidate = value as Record<string, unknown>;
  const expectedKeys = ["requestId", "sessionId", "cardId", "rating", "expectedScheduleVersion"];
  const keys = Object.keys(candidate);
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => Object.hasOwn(candidate, key))) {
    return { success: false };
  }
  const requestId = parseCanonicalUuid(candidate.requestId);
  const sessionId = parseCanonicalUuid(candidate.sessionId);
  const cardId = parseCanonicalUuid(candidate.cardId);
  const rating = parseReviewRating(candidate.rating);
  if (
    !requestId.success ||
    !sessionId.success ||
    !cardId.success ||
    !rating.success ||
    !Number.isSafeInteger(candidate.expectedScheduleVersion) ||
    typeof candidate.expectedScheduleVersion !== "number" ||
    candidate.expectedScheduleVersion < 0
  ) {
    return { success: false };
  }
  return {
    success: true,
    data: {
      requestId: requestId.data,
      sessionId: sessionId.data,
      cardId: cardId.data,
      rating: rating.data,
      expectedScheduleVersion: candidate.expectedScheduleVersion,
    },
  };
}

export function canonicalIso(value: string | Date): string {
  return new Date(value).toISOString();
}

export function isJsonObject(value: unknown): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type ReviewSessionRow = Tables<"flashcard_review_sessions">;
export type ReviewMemberRow = Tables<"flashcard_review_session_cards">;
export type ScheduledFlashcardRow = Tables<"flashcards">;
