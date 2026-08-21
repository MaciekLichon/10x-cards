import { RotateCcw, Trash2 } from "lucide-react";
import { ANSWER_MAX_LENGTH, QUESTION_MAX_LENGTH } from "@/lib/flashcards";

export interface EditableProposal {
  id: string;
  question: string;
  answer: string;
  accepted: boolean;
}

interface ProposalCardProps {
  proposal: EditableProposal;
  index: number;
  disabled: boolean;
  onChange: (id: string, field: "question" | "answer", value: string) => void;
  onToggle: (id: string) => void;
}

function fieldError(value: string, limit: number, label: string): string | undefined {
  if (!value.trim()) return `${label} cannot be empty.`;
  if (value.trim().length > limit) return `${label} must contain at most ${limit} characters.`;
}

export function ProposalCard({ proposal, index, disabled, onChange, onToggle }: ProposalCardProps) {
  const questionError = fieldError(proposal.question, QUESTION_MAX_LENGTH, "Question");
  const answerError = fieldError(proposal.answer, ANSWER_MAX_LENGTH, "Answer");
  const prefix = `proposal-${proposal.id}`;

  return (
    <article
      className={`rounded-xl border p-4 ${proposal.accepted ? "border-white/15 bg-white/8" : "border-white/10 bg-black/20 opacity-70"}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-blue-100">Card {index + 1}</h3>
        <button
          type="button"
          onClick={() => {
            onToggle(proposal.id);
          }}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-blue-100 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={proposal.accepted ? `Reject card ${index + 1}` : `Restore card ${index + 1}`}
        >
          {proposal.accepted ? <Trash2 className="size-4" /> : <RotateCcw className="size-4" />}
          {proposal.accepted ? "Reject" : "Restore"}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor={`${prefix}-question`} className="mb-1 block text-sm text-blue-100/80">
            Question
          </label>
          <textarea
            id={`${prefix}-question`}
            value={proposal.question}
            onChange={(event) => {
              onChange(proposal.id, "question", event.target.value);
            }}
            disabled={disabled || !proposal.accepted}
            rows={2}
            maxLength={QUESTION_MAX_LENGTH + 1}
            aria-invalid={Boolean(questionError)}
            aria-describedby={`${prefix}-question-meta`}
            className="w-full resize-y rounded-lg border border-white/15 bg-slate-950/40 px-3 py-2 text-white focus:border-purple-300 focus:ring-2 focus:ring-purple-300/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div id={`${prefix}-question-meta`} className="mt-1 flex justify-between gap-3 text-xs">
            <span className="text-red-300">{proposal.accepted ? questionError : undefined}</span>
            <span
              className={proposal.question.trim().length > QUESTION_MAX_LENGTH ? "text-red-300" : "text-blue-100/50"}
            >
              {proposal.question.trim().length}/{QUESTION_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor={`${prefix}-answer`} className="mb-1 block text-sm text-blue-100/80">
            Answer
          </label>
          <textarea
            id={`${prefix}-answer`}
            value={proposal.answer}
            onChange={(event) => {
              onChange(proposal.id, "answer", event.target.value);
            }}
            disabled={disabled || !proposal.accepted}
            rows={4}
            maxLength={ANSWER_MAX_LENGTH + 1}
            aria-invalid={Boolean(answerError)}
            aria-describedby={`${prefix}-answer-meta`}
            className="w-full resize-y rounded-lg border border-white/15 bg-slate-950/40 px-3 py-2 text-white focus:border-purple-300 focus:ring-2 focus:ring-purple-300/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div id={`${prefix}-answer-meta`} className="mt-1 flex justify-between gap-3 text-xs">
            <span className="text-red-300">{proposal.accepted ? answerError : undefined}</span>
            <span className={proposal.answer.trim().length > ANSWER_MAX_LENGTH ? "text-red-300" : "text-blue-100/50"}>
              {proposal.answer.trim().length}/{ANSWER_MAX_LENGTH}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function isProposalValid(proposal: EditableProposal): boolean {
  return (
    proposal.question.trim().length > 0 &&
    proposal.question.trim().length <= QUESTION_MAX_LENGTH &&
    proposal.answer.trim().length > 0 &&
    proposal.answer.trim().length <= ANSWER_MAX_LENGTH
  );
}
