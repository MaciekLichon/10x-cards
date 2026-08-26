import type { CollectionFlashcard } from "@/lib/flashcards";

export function FlashcardCollectionCard({ flashcard }: { flashcard: CollectionFlashcard }) {
  const createdAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(flashcard.createdAt));

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-white/15 bg-white/8 p-5 shadow-lg shadow-black/10">
      <p className="text-xs font-semibold tracking-wider text-purple-200 uppercase">Front</p>
      <h3 className="mt-1 text-lg font-semibold [overflow-wrap:anywhere] whitespace-pre-wrap text-white">
        {flashcard.front}
      </h3>
      <div className="my-4 h-px bg-white/10" />
      <p className="text-xs font-semibold tracking-wider text-blue-200 uppercase">Back</p>
      <p className="mt-1 grow [overflow-wrap:anywhere] whitespace-pre-wrap text-blue-50/85">{flashcard.back}</p>
      <p className="mt-5 text-xs text-blue-100/50">Created {createdAt}</p>
    </article>
  );
}
