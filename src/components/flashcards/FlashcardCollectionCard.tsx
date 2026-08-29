import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CollectionFlashcard, UpdateFlashcardInput } from "@/lib/flashcards";
import { ANSWER_MAX_LENGTH, QUESTION_MAX_LENGTH } from "@/lib/flashcards";

interface Props {
  flashcard: CollectionFlashcard;
  editing: boolean;
  mutationBusy: boolean;
  mutationControlsDisabled: boolean;
  mutationError?: string;
  onEdit: () => boolean;
  onDirtyChange: (dirty: boolean) => void;
  onCancelEdit: () => void;
  onSave: (input: UpdateFlashcardInput) => Promise<boolean>;
  onRequestDelete: (trigger: HTMLButtonElement) => void;
}

export function FlashcardCollectionCard({
  flashcard,
  editing,
  mutationBusy,
  mutationControlsDisabled,
  mutationError,
  onEdit,
  onDirtyChange,
  onCancelEdit,
  onSave,
  onRequestDelete,
}: Props) {
  const [front, setFront] = useState(flashcard.front);
  const [back, setBack] = useState(flashcard.back);
  const frontId = useId();
  const backId = useId();
  const errorId = useId();
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const createdAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(flashcard.createdAt));
  const trimmedFront = front.trim();
  const trimmedBack = back.trim();
  const frontInvalid = trimmedFront.length === 0 || trimmedFront.length > QUESTION_MAX_LENGTH;
  const backInvalid = trimmedBack.length === 0 || trimmedBack.length > ANSWER_MAX_LENGTH;
  const dirty = front !== flashcard.front || back !== flashcard.back;

  useEffect(() => {
    if (editing) frontRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (editing) onDirtyChange(dirty);
  }, [dirty, editing, onDirtyChange]);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (frontInvalid || backInvalid || mutationBusy) return;
    const saved = await onSave({
      id: flashcard.id,
      front: trimmedFront,
      back: trimmedBack,
      updatedAt: flashcard.updatedAt,
    });
    if (saved) {
      setFront(trimmedFront);
      setBack(trimmedBack);
    }
  }

  function cancel() {
    setFront(flashcard.front);
    setBack(flashcard.back);
    onDirtyChange(false);
    onCancelEdit();
  }

  function beginEdit() {
    setFront(flashcard.front);
    setBack(flashcard.back);
    onEdit();
  }

  return (
    <article
      data-card-id={flashcard.id}
      aria-busy={mutationBusy || undefined}
      className="flex h-full min-w-0 flex-col rounded-xl border border-white/15 bg-white/8 p-5 shadow-lg shadow-black/10"
    >
      {editing ? (
        <form className="flex grow flex-col" onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor={frontId} className="text-xs font-semibold tracking-wider text-purple-200 uppercase">
            Front
          </label>
          <textarea
            ref={frontRef}
            id={frontId}
            value={front}
            onChange={(event) => {
              setFront(event.target.value);
            }}
            aria-invalid={frontInvalid}
            aria-describedby={frontInvalid ? errorId : undefined}
            disabled={mutationBusy}
            maxLength={QUESTION_MAX_LENGTH + 1}
            rows={4}
            className="mt-2 resize-y rounded-lg border border-white/20 bg-blue-950/60 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:opacity-60"
          />
          <p className="mt-1 text-right text-xs text-blue-100/60">
            {front.length}/{QUESTION_MAX_LENGTH}
          </p>
          <label htmlFor={backId} className="mt-3 text-xs font-semibold tracking-wider text-blue-200 uppercase">
            Back
          </label>
          <textarea
            id={backId}
            value={back}
            onChange={(event) => {
              setBack(event.target.value);
            }}
            aria-invalid={backInvalid}
            aria-describedby={backInvalid ? errorId : undefined}
            disabled={mutationBusy}
            maxLength={ANSWER_MAX_LENGTH + 1}
            rows={6}
            className="mt-2 resize-y rounded-lg border border-white/20 bg-blue-950/60 px-3 py-2 text-blue-50 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:opacity-60"
          />
          <p className="mt-1 text-right text-xs text-blue-100/60">
            {back.length}/{ANSWER_MAX_LENGTH}
          </p>
          {(frontInvalid || backInvalid) && (
            <p id={errorId} className="mt-2 text-sm text-red-200">
              Front must contain 1–{QUESTION_MAX_LENGTH} characters and back 1–{ANSWER_MAX_LENGTH} characters after
              trimming.
            </p>
          )}
          {mutationError && (
            <p role="alert" className="mt-2 text-sm text-red-200">
              {mutationError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={mutationBusy || mutationControlsDisabled || frontInvalid || backInvalid}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-400 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutationBusy && <LoaderCircle className="size-4 animate-spin" />}
              {mutationBusy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={mutationBusy}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-xs font-semibold tracking-wider text-purple-200 uppercase">Front</p>
          <h3 className="mt-1 text-lg font-semibold [overflow-wrap:anywhere] whitespace-pre-wrap text-white">
            {flashcard.front}
          </h3>
          <div className="my-4 h-px bg-white/10" />
          <p className="text-xs font-semibold tracking-wider text-blue-200 uppercase">Back</p>
          <p className="mt-1 grow [overflow-wrap:anywhere] whitespace-pre-wrap text-blue-50/85">{flashcard.back}</p>
          <p className="mt-5 text-xs text-blue-100/50">Created {createdAt}</p>
          {mutationError && (
            <p role="alert" className="mt-3 text-sm text-red-200">
              {mutationError}
            </p>
          )}
          <div className="mt-4 flex gap-4 border-t border-white/10 pt-4">
            <button
              type="button"
              data-flashcard-action
              onClick={beginEdit}
              disabled={mutationControlsDisabled}
              className="text-sm font-medium text-purple-200 hover:text-purple-100 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              Edit flashcard
            </button>
            <button
              type="button"
              onClick={(event) => {
                onRequestDelete(event.currentTarget);
              }}
              disabled={mutationControlsDisabled}
              className="text-sm font-medium text-red-200 hover:text-red-100 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete flashcard
            </button>
          </div>
        </>
      )}
    </article>
  );
}
