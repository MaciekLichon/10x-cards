export const SOURCE_MIN_LENGTH = 1_000;
export const SOURCE_MAX_LENGTH = 10_000;
export const QUESTION_MAX_LENGTH = 200;
export const ANSWER_MAX_LENGTH = 500;
export const PROPOSAL_MAX_COUNT = 15;

export interface FlashcardProposal {
  question: string;
  answer: string;
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
