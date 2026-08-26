import { FlashcardCollectionCard } from "@/components/flashcards/FlashcardCollectionCard";
import type { CollectionFlashcard } from "@/lib/flashcards";

interface Props {
  flashcards: CollectionFlashcard[];
  onAdd: () => void;
}

export function FlashcardCollectionList({ flashcards, onAdd }: Props) {
  if (flashcards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center">
        <h2 className="text-xl font-semibold text-white">Your collection is empty</h2>
        <p className="mt-2 text-blue-100/60">Create your first card manually or save a set from the AI workspace.</p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 rounded-lg bg-purple-500 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-400 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none"
        >
          Add flashcard
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="collection-heading">
      <h2 id="collection-heading" className="sr-only">
        Flashcards
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {flashcards.map((flashcard) => (
          <FlashcardCollectionCard key={flashcard.id} flashcard={flashcard} />
        ))}
      </div>
    </section>
  );
}
