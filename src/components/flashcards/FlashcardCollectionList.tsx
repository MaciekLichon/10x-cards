import { useCallback, useRef } from "react";
import { FlashcardCollectionCard } from "@/components/flashcards/FlashcardCollectionCard";
import type { CollectionFlashcard, UpdateFlashcardInput } from "@/lib/flashcards";

interface Props {
  flashcards: CollectionFlashcard[];
  editingId: string | null;
  mutationId: string | null;
  mutationError?: { id: string; message: string };
  onAdd: () => void;
  onEdit: (id: string) => boolean;
  onDirtyChange: (dirty: boolean) => void;
  onCancelEdit: () => void;
  onSave: (input: UpdateFlashcardInput) => Promise<boolean>;
  onRequestDelete: (flashcard: CollectionFlashcard, trigger: HTMLButtonElement, focusAfterDelete: () => void) => void;
}

export function FlashcardCollectionList({
  flashcards,
  editingId,
  mutationId,
  mutationError,
  onAdd,
  onEdit,
  onDirtyChange,
  onCancelEdit,
  onSave,
  onRequestDelete,
}: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const focusAfterDelete = useCallback((deletedIndex: number) => {
    requestAnimationFrame(() => {
      const actions = containerRef.current?.querySelectorAll<HTMLElement>("[data-flashcard-action]");
      if (actions?.length) actions[Math.min(deletedIndex, actions.length - 1)].focus();
      else containerRef.current?.querySelector<HTMLElement>("[data-collection-heading]")?.focus();
    });
  }, []);

  if (flashcards.length === 0) {
    return (
      <section
        ref={containerRef}
        className="rounded-xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center"
      >
        <h2 data-collection-heading tabIndex={-1} className="text-xl font-semibold text-white focus:outline-none">
          Your collection is empty
        </h2>
        <p className="mt-2 text-blue-100/60">Create your first card manually or save a set from the AI workspace.</p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 rounded-lg bg-purple-500 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-400 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none"
        >
          Add flashcard
        </button>
      </section>
    );
  }

  return (
    <section ref={containerRef} aria-labelledby="collection-heading">
      <h2 id="collection-heading" data-collection-heading tabIndex={-1} className="sr-only focus:not-sr-only">
        Flashcards
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {flashcards.map((flashcard, index) => (
          <FlashcardCollectionCard
            key={flashcard.id}
            flashcard={flashcard}
            editing={editingId === flashcard.id}
            mutationBusy={mutationId === flashcard.id}
            mutationControlsDisabled={mutationId !== null}
            mutationError={mutationError?.id === flashcard.id ? mutationError.message : undefined}
            onEdit={() => onEdit(flashcard.id)}
            onDirtyChange={onDirtyChange}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
            onRequestDelete={(trigger) => {
              onRequestDelete(flashcard, trigger, () => {
                focusAfterDelete(index);
              });
            }}
          />
        ))}
      </div>
    </section>
  );
}
