import { LoaderCircle, Plus, X } from "lucide-react";
import { useState, type SyntheticEvent } from "react";
import { ANSWER_MAX_LENGTH, QUESTION_MAX_LENGTH, type ManualFlashcardInput } from "@/lib/flashcards";

interface Props {
  busy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ManualFlashcardInput) => Promise<boolean>;
}

function fieldError(value: string, limit: number, label: string): string | undefined {
  if (!value.trim()) return `${label} cannot be empty.`;
  if (value.trim().length > limit) return `${label} must contain at most ${limit} characters.`;
}

export function ManualFlashcardForm({ busy, open, onOpenChange, onSubmit }: Props) {
  const [id, setId] = useState(() => crypto.randomUUID());
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const frontError = fieldError(front, QUESTION_MAX_LENGTH, "Front");
  const backError = fieldError(back, ANSWER_MAX_LENGTH, "Back");

  function setOpen(next: boolean) {
    onOpenChange(next);
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (frontError || backError || busy) return;
    if (await onSubmit({ id, front: front.trim(), back: back.trim() })) {
      setFront("");
      setBack("");
      setId(crypto.randomUUID());
      setSubmitted(false);
      onOpenChange(false);
    }
  }

  return (
    <section aria-labelledby="manual-card-heading" className="rounded-xl border border-white/15 bg-white/8 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="manual-card-heading" className="text-lg font-semibold text-white">
            Create a flashcard
          </h2>
          <p className="text-sm text-blue-100/60">Add a front and back directly to your collection.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
          }}
          disabled={busy}
          aria-expanded={open}
          aria-controls="manual-flashcard-fields"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-400 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? "Close" : "Add flashcard"}
        </button>
      </div>

      {open && (
        <form id="manual-flashcard-fields" onSubmit={submit} className="mt-5 space-y-4" noValidate>
          {(
            [
              ["front", "Front", front, setFront, QUESTION_MAX_LENGTH, frontError],
              ["back", "Back", back, setBack, ANSWER_MAX_LENGTH, backError],
            ] as const
          ).map(([name, label, value, setter, limit, error]) => (
            <div key={name}>
              <label htmlFor={`manual-${name}`} className="mb-1 block text-sm text-blue-100/80">
                {label}
              </label>
              <textarea
                id={`manual-${name}`}
                value={value}
                onChange={(event) => {
                  setter(event.target.value);
                }}
                disabled={busy}
                rows={name === "front" ? 2 : 4}
                maxLength={limit + 1}
                aria-invalid={submitted && Boolean(error)}
                aria-describedby={`manual-${name}-meta`}
                className="w-full resize-y rounded-lg border border-white/15 bg-slate-950/40 px-3 py-2 text-white focus:border-purple-300 focus:ring-2 focus:ring-purple-300/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div id={`manual-${name}-meta`} className="mt-1 flex justify-between gap-3 text-xs">
                <span className="text-red-300">{submitted ? error : undefined}</span>
                <span className={value.trim().length > limit ? "text-red-300" : "text-blue-100/50"}>
                  {value.trim().length}/{limit}
                </span>
              </div>
            </div>
          ))}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-400 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? "Saving…" : "Save flashcard"}
          </button>
        </form>
      )}
    </section>
  );
}
