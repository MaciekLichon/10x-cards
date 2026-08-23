export const SOURCE_MIN_LENGTH = 1_000;
export const SOURCE_MAX_LENGTH = 10_000;
export const QUESTION_MAX_LENGTH = 200;
export const ANSWER_MAX_LENGTH = 500;
export const PROPOSAL_MAX_COUNT = 15;
export const COLLECTION_PAGE_SIZE = 20;

export interface FlashcardProposal {
  question: string;
  answer: string;
}

export interface PersistedFlashcardProposal extends FlashcardProposal {
  id: string;
}

export interface ManualFlashcardInput {
  id: string;
  front: string;
  back: string;
}

export interface CollectionFlashcard {
  id: string;
  front: string;
  back: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionCursor {
  createdAt: string;
  id: string;
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; reason: "invalid_input" | "unusable_output" };

export function parseSourceText(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return { success: false, reason: "invalid_input" };
  const sourceText = value.trim();
  if (sourceText.length < SOURCE_MIN_LENGTH || sourceText.length > SOURCE_MAX_LENGTH) {
    return { success: false, reason: "invalid_input" };
  }
  return { success: true, data: sourceText };
}

function normalizedQuestionKey(question: string): string {
  return question
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseManualFlashcard(value: unknown): ParseResult<ManualFlashcardInput> {
  if (typeof value !== "object" || value === null) return { success: false, reason: "invalid_input" };
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.front !== "string" || typeof candidate.back !== "string") {
    return { success: false, reason: "invalid_input" };
  }

  const id = candidate.id.toLowerCase();
  const front = candidate.front.trim();
  const back = candidate.back.trim();
  if (
    !UUID_PATTERN.test(id) ||
    !front ||
    front.length > QUESTION_MAX_LENGTH ||
    !back ||
    back.length > ANSWER_MAX_LENGTH
  ) {
    return { success: false, reason: "invalid_input" };
  }
  return { success: true, data: { id, front, back } };
}

export function encodeCollectionCursor(cursor: CollectionCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function parseCollectionCursor(value: unknown): ParseResult<CollectionCursor> {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return { success: false, reason: "invalid_input" };
  }

  try {
    const encoded = value.replaceAll("-", "+").replaceAll("_", "/");
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))) as unknown;
    if (typeof payload !== "object" || payload === null) return { success: false, reason: "invalid_input" };
    const candidate = payload as Record<string, unknown>;
    if (typeof candidate.createdAt !== "string" || typeof candidate.id !== "string") {
      return { success: false, reason: "invalid_input" };
    }
    const id = candidate.id.toLowerCase();
    const createdAt = new Date(candidate.createdAt);
    if (!UUID_PATTERN.test(id) || !Number.isFinite(createdAt.getTime())) {
      return { success: false, reason: "invalid_input" };
    }
    return { success: true, data: { createdAt: createdAt.toISOString(), id } };
  } catch {
    return { success: false, reason: "invalid_input" };
  }
}

export function parsePersistedProposals(value: unknown): ParseResult<PersistedFlashcardProposal[]> {
  if (!Array.isArray(value) || value.length === 0 || value.length > PROPOSAL_MAX_COUNT) {
    return { success: false, reason: "invalid_input" };
  }

  const proposals: PersistedFlashcardProposal[] = [];
  const ids = new Set<string>();
  const questions = new Set<string>();
  for (const candidateValue of value as unknown[]) {
    if (typeof candidateValue !== "object" || candidateValue === null) {
      return { success: false, reason: "invalid_input" };
    }
    const candidate = candidateValue as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.question !== "string" ||
      typeof candidate.answer !== "string"
    ) {
      return { success: false, reason: "invalid_input" };
    }
    const id = candidate.id.toLowerCase();
    const question = candidate.question.trim();
    const answer = candidate.answer.trim();
    const questionKey = normalizedQuestionKey(question);
    if (
      !UUID_PATTERN.test(id) ||
      ids.has(id) ||
      !questionKey ||
      questions.has(questionKey) ||
      question.length > QUESTION_MAX_LENGTH ||
      !answer ||
      answer.length > ANSWER_MAX_LENGTH
    ) {
      return { success: false, reason: "invalid_input" };
    }
    ids.add(id);
    questions.add(questionKey);
    proposals.push({ id, question, answer });
  }

  return { success: true, data: proposals };
}

export function parseProposals(value: unknown): ParseResult<FlashcardProposal[]> {
  if (typeof value !== "object" || value === null) {
    return { success: false, reason: "unusable_output" };
  }
  const proposalValue = (value as Record<string, unknown>).proposals;
  if (!Array.isArray(proposalValue)) return { success: false, reason: "unusable_output" };

  const proposals: FlashcardProposal[] = [];
  const questions = new Set<string>();
  for (const candidateValue of proposalValue as unknown[]) {
    if (typeof candidateValue !== "object" || candidateValue === null) continue;
    const candidate = candidateValue as Record<string, unknown>;
    const questionValue = candidate.question;
    const answerValue = candidate.answer;
    if (typeof questionValue !== "string" || typeof answerValue !== "string") continue;
    const question = questionValue.trim();
    const answer = answerValue.trim();
    const key = normalizedQuestionKey(question);
    if (!question || !answer || question.length > QUESTION_MAX_LENGTH || answer.length > ANSWER_MAX_LENGTH || !key)
      continue;
    if (questions.has(key)) continue;
    questions.add(key);
    proposals.push({ question, answer });
    if (proposals.length === PROPOSAL_MAX_COUNT) break;
  }

  return proposals.length > 0 ? { success: true, data: proposals } : { success: false, reason: "unusable_output" };
}
