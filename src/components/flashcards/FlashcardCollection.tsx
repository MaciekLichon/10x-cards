import { LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlashcardCollectionList } from "@/components/flashcards/FlashcardCollectionList";
import { ManualFlashcardForm } from "@/components/flashcards/ManualFlashcardForm";
import type { CollectionFlashcard, ManualFlashcardInput } from "@/lib/flashcards";

interface CollectionResponse {
  flashcards?: CollectionFlashcard[];
  nextCursor?: string | null;
  error?: { code?: string };
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Your session has expired. Sign in again to view your collection.",
  invalid_cursor: "The next collection page could not be requested. Refresh the collection and try again.",
  invalid_origin: "This request could not be verified. Refresh the page and try again.",
  invalid_json: "The save request was invalid. Please try again.",
  invalid_flashcard: "Check the front and back, then try again.",
  database_unavailable: "Flashcard storage is not configured for this environment.",
  collection_unavailable: "Your collection is temporarily unavailable. Please try again.",
  save_failed: "The flashcard was not saved. Your content is preserved; it is safe to try again.",
  save_ambiguous: "The save result could not be confirmed. Do not resubmit this card yet.",
  save_conflict: "This card ID is already associated with different content. Do not retry this card.",
  id_conflict: "This card ID cannot be used. Do not retry this card.",
};

function messageFor(code: string | undefined, fallback: string): string {
  return (code ? ERROR_MESSAGES[code] : undefined) ?? fallback;
}

export default function FlashcardCollection() {
  const [flashcards, setFlashcards] = useState<CollectionFlashcard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [collectionError, setCollectionError] = useState<string>();
  const [paginationError, setPaginationError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const successRef = useRef<HTMLParagraphElement>(null);

  const loadFirstPage = useCallback(async (afterSave = false): Promise<boolean> => {
    setInitialLoading(true);
    setCollectionError(undefined);
    setPaginationError(undefined);
    try {
      const response = await fetch("/api/flashcards/collection");
      const body: CollectionResponse = await response.json();
      if (!response.ok || !body.flashcards) throw new Error(body.error?.code ?? "collection_unavailable");
      setFlashcards(body.flashcards);
      setNextCursor(body.nextCursor ?? null);
      return true;
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : undefined;
      setCollectionError(messageFor(code, "Your collection could not be loaded. Please try again."));
      if (afterSave) setNotice("Flashcard saved. Refresh the collection to see the latest cards.");
      return false;
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadFirstPage();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [loadFirstPage]);

  async function loadMore() {
    if (!nextCursor || loadingMore || saving || initialLoading) return;
    setLoadingMore(true);
    setPaginationError(undefined);
    try {
      const response = await fetch(`/api/flashcards/collection?cursor=${encodeURIComponent(nextCursor)}`);
      const body: CollectionResponse = await response.json();
      if (!response.ok || !body.flashcards) throw new Error(body.error?.code ?? "collection_unavailable");
      const additionalFlashcards = body.flashcards;
      setFlashcards((current) => [...current, ...additionalFlashcards]);
      setNextCursor(body.nextCursor ?? null);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : undefined;
      setPaginationError(messageFor(code, "Older flashcards could not be loaded. Please try again."));
    } finally {
      setLoadingMore(false);
    }
  }

  async function sendSave(input: ManualFlashcardInput, reconcile = false): Promise<CollectionResponse> {
    const response = await fetch("/api/flashcards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, ...(reconcile ? { reconcile: true } : {}) }),
    });
    const body: CollectionResponse = await response.json();
    if (!response.ok) throw new Error(body.error?.code ?? "save_failed");
    return body;
  }

  async function save(input: ManualFlashcardInput): Promise<boolean> {
    if (saving || loadingMore || initialLoading) return false;
    setSaving(true);
    setSaveError(undefined);
    setNotice(undefined);
    try {
      try {
        await sendSave(input);
      } catch (caught) {
        const code = caught instanceof Error ? caught.message : "save_failed";
        if (code !== "save_ambiguous") throw caught;
        await sendSave(input, true);
      }
      setNotice("Flashcard saved. Refreshing your collection…");
      const refreshed = await loadFirstPage(true);
      if (!refreshed) return false;
      setNotice("Flashcard saved and collection refreshed.");
      requestAnimationFrame(() => successRef.current?.focus());
      return true;
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : undefined;
      setSaveError(messageFor(code, "The flashcard could not be saved. Your content is preserved."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ManualFlashcardForm
        busy={saving || loadingMore || initialLoading}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={save}
      />

      <div aria-live="polite" aria-atomic="true">
        {notice && (
          <p
            ref={successRef}
            tabIndex={-1}
            className="rounded-lg border border-emerald-400/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-100 focus:outline-none"
          >
            {notice}
          </p>
        )}
      </div>
      {saveError && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-500/30 bg-red-900/30 px-4 py-3 text-sm text-red-200"
        >
          {saveError}
        </p>
      )}

      {initialLoading && flashcards.length === 0 ? (
        <p role="status" className="flex items-center justify-center gap-2 py-16 text-blue-100/70">
          <LoaderCircle className="size-5 animate-spin" /> Loading your collection…
        </p>
      ) : collectionError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-5">
          <p role="alert" className="text-red-200">
            {collectionError}
          </p>
          <button
            type="button"
            onClick={() => void loadFirstPage()}
            disabled={initialLoading}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${initialLoading ? "animate-spin" : ""}`} /> Retry
          </button>
        </div>
      ) : (
        <FlashcardCollectionList
          flashcards={flashcards}
          onAdd={() => {
            setFormOpen(true);
          }}
        />
      )}

      {paginationError && (
        <p role="alert" className="text-center text-sm text-red-200">
          {paginationError}
        </p>
      )}
      {nextCursor && !collectionError && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore || saving || initialLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore && <LoaderCircle className="size-4 animate-spin" />}
            {loadingMore ? "Loading…" : paginationError ? "Try Load More again" : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
