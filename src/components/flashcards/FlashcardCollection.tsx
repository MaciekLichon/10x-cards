import { LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlashcardCollectionList } from "@/components/flashcards/FlashcardCollectionList";
import { FlashcardDeleteDialog } from "@/components/flashcards/FlashcardDeleteDialog";
import { ManualFlashcardForm } from "@/components/flashcards/ManualFlashcardForm";
import type { CollectionFlashcard, ManualFlashcardInput, UpdateFlashcardInput } from "@/lib/flashcards";

interface CollectionResponse {
  flashcards?: CollectionFlashcard[];
  nextCursor?: string | null;
  error?: { code?: string };
}
interface MutationResponse {
  flashcard?: CollectionFlashcard;
  deletedId?: string;
  error?: { code?: string };
}
interface DeleteRequest {
  flashcard: CollectionFlashcard;
  trigger: HTMLButtonElement;
  focusAfterDelete: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Your session has expired. Sign in again.",
  invalid_cursor: "The next collection page could not be requested. Refresh the collection and try again.",
  invalid_origin: "This request could not be verified. Refresh the page and try again.",
  invalid_json: "The request was invalid. Please try again.",
  invalid_flashcard: "Check the front and back, then try again.",
  invalid_flashcard_id: "This flashcard could not be identified.",
  database_unavailable: "Flashcard storage is not configured for this environment.",
  collection_unavailable: "Your collection is temporarily unavailable. Please try again.",
  save_failed: "The flashcard was not saved. Your content is preserved; it is safe to try again.",
  save_ambiguous: "The save result could not be confirmed. Do not resubmit this card yet.",
  save_conflict: "This card ID is already associated with different content. Do not retry this card.",
  id_conflict: "This card ID cannot be used. Do not retry this card.",
  update_failed: "The flashcard was not updated. Your draft is preserved; it is safe to try again.",
  delete_failed: "The flashcard was not deleted. It is safe to try again.",
  mutation_conflict:
    "This flashcard changed elsewhere. Your draft is preserved; review the latest version before trying again.",
  flashcard_not_found: "This flashcard is no longer available.",
  mutation_ambiguous: "The result could not be confirmed. The collection was refreshed without repeating the change.",
};

function messageFor(code: string | undefined, fallback: string): string {
  return (code ? ERROR_MESSAGES[code] : undefined) ?? fallback;
}
function isAtOrPastBoundary(card: CollectionFlashcard, boundary: CollectionFlashcard): boolean {
  return card.createdAt < boundary.createdAt || (card.createdAt === boundary.createdAt && card.id <= boundary.id);
}

export default function FlashcardCollection() {
  const [flashcards, setFlashcards] = useState<CollectionFlashcard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<{ id: string; message: string }>();
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest>();
  const [collectionError, setCollectionError] = useState<string>();
  const [paginationError, setPaginationError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const successRef = useRef<HTMLParagraphElement>(null);
  const generationRef = useRef(0);

  const loadFirstPage = useCallback(async (afterSave = false): Promise<boolean> => {
    const generation = ++generationRef.current;
    setInitialLoading(true);
    setCollectionError(undefined);
    setPaginationError(undefined);
    try {
      const response = await fetch("/api/flashcards/collection");
      const body: CollectionResponse = await response.json();
      if (!response.ok || !body.flashcards) throw new Error(body.error?.code ?? "collection_unavailable");
      if (generation !== generationRef.current) return false;
      setFlashcards(body.flashcards);
      setNextCursor(body.nextCursor ?? null);
      return true;
    } catch (caught) {
      if (generation !== generationRef.current) return false;
      const code = caught instanceof Error ? caught.message : undefined;
      setCollectionError(messageFor(code, "Your collection could not be loaded. Please try again."));
      if (afterSave) setNotice("Flashcard saved. Refresh the collection to see the latest cards.");
      return false;
    } finally {
      if (generation === generationRef.current) setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadFirstPage());
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [loadFirstPage]);

  async function loadMore() {
    if (!nextCursor || loadingMore || saving || initialLoading || reconciling) return;
    const generation = generationRef.current;
    setLoadingMore(true);
    setPaginationError(undefined);
    try {
      const response = await fetch(`/api/flashcards/collection?cursor=${encodeURIComponent(nextCursor)}`);
      const body: CollectionResponse = await response.json();
      if (!response.ok || !body.flashcards) throw new Error(body.error?.code ?? "collection_unavailable");
      if (generation !== generationRef.current) return;
      const additionalFlashcards = body.flashcards;
      setFlashcards((current) => {
        const ids = new Set(current.map((card) => card.id));
        return [...current, ...additionalFlashcards.filter((card) => !ids.has(card.id))];
      });
      setNextCursor(body.nextCursor ?? null);
    } catch (caught) {
      if (generation === generationRef.current)
        setPaginationError(
          messageFor(
            caught instanceof Error ? caught.message : undefined,
            "Older flashcards could not be loaded. Please try again.",
          ),
        );
    } finally {
      if (generation === generationRef.current) setLoadingMore(false);
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
        if (!(caught instanceof Error) || caught.message !== "save_ambiguous") throw caught;
        await sendSave(input, true);
      }
      setNotice("Flashcard saved. Refreshing your collection…");
      if (!(await loadFirstPage(true))) return false;
      setNotice("Flashcard saved and collection refreshed.");
      requestAnimationFrame(() => successRef.current?.focus());
      return true;
    } catch (caught) {
      setSaveError(
        messageFor(
          caught instanceof Error ? caught.message : undefined,
          "The flashcard could not be saved. Your content is preserved.",
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendMutation(
    method: "PATCH" | "DELETE",
    input: UpdateFlashcardInput | { id: string; updatedAt: string },
  ): Promise<MutationResponse> {
    let response: Response;
    try {
      response = await fetch(`/api/flashcards/${input.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      throw new Error("mutation_ambiguous");
    }

    let body: MutationResponse;
    try {
      body = await response.json();
    } catch {
      throw new Error("mutation_ambiguous");
    }
    if (!response.ok) throw new Error(body.error?.code ?? (method === "PATCH" ? "update_failed" : "delete_failed"));
    return body;
  }

  async function rebuildLoadedWindow(boundary: CollectionFlashcard | undefined): Promise<CollectionFlashcard[]> {
    const generation = ++generationRef.current;
    setReconciling(true);
    setPaginationError(undefined);
    const rebuilt: CollectionFlashcard[] = [];
    const ids = new Set<string>();
    let cursor: string | null = null;
    try {
      do {
        const response = await fetch(
          `/api/flashcards/collection${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        const body: CollectionResponse = await response.json();
        if (!response.ok || !body.flashcards) throw new Error(body.error?.code ?? "collection_unavailable");
        for (const card of body.flashcards)
          if (!ids.has(card.id)) {
            ids.add(card.id);
            rebuilt.push(card);
          }
        const last = body.flashcards.at(-1);
        cursor = body.nextCursor ?? null;
        if (!boundary || !cursor || (last && isAtOrPastBoundary(last, boundary))) break;
      } while (cursor);
      if (generation === generationRef.current) {
        setFlashcards(rebuilt);
        setNextCursor(cursor);
      }
      return rebuilt;
    } finally {
      if (generation === generationRef.current) setReconciling(false);
    }
  }

  function beginEdit(id: string): boolean {
    if (mutationId || id === editingId) return false;
    if (editingId && editorDirty && !window.confirm("Discard your unsaved changes and edit another flashcard?"))
      return false;
    setEditingId(id);
    setEditorDirty(false);
    setMutationError(undefined);
    return true;
  }

  async function update(input: UpdateFlashcardInput): Promise<boolean> {
    if (mutationId) return false;
    const boundary = flashcards.at(-1);
    setMutationId(input.id);
    setMutationError(undefined);
    setNotice(undefined);
    try {
      let updated: CollectionFlashcard | undefined;
      try {
        updated = (await sendMutation("PATCH", input)).flashcard;
      } catch (caught) {
        const code = caught instanceof Error ? caught.message : "update_failed";
        if (code !== "mutation_ambiguous") throw caught;
        const rebuilt = await rebuildLoadedWindow(boundary);
        const current = rebuilt.find((card) => card.id === input.id);
        if (
          current &&
          current.updatedAt !== input.updatedAt &&
          current.front === input.front &&
          current.back === input.back
        )
          updated = current;
        else throw new Error(current?.updatedAt !== input.updatedAt ? "mutation_conflict" : "mutation_ambiguous");
      }
      if (!updated) throw new Error("update_failed");
      const confirmedUpdate = updated;
      setFlashcards((current) => current.map((card) => (card.id === confirmedUpdate.id ? confirmedUpdate : card)));
      setEditingId(null);
      setEditorDirty(false);
      setNotice("Flashcard updated.");
      requestAnimationFrame(() => successRef.current?.focus());
      return true;
    } catch (caught) {
      setMutationError({
        id: input.id,
        message: messageFor(
          caught instanceof Error ? caught.message : undefined,
          "The flashcard could not be updated. Your draft is preserved.",
        ),
      });
      return false;
    } finally {
      setMutationId(null);
    }
  }

  function cancelDelete() {
    const request = deleteRequest;
    setDeleteRequest(undefined);
    requestAnimationFrame(() => request?.trigger.focus());
  }

  async function confirmDelete() {
    if (!deleteRequest || mutationId) return;
    const { flashcard, focusAfterDelete } = deleteRequest;
    const boundary = flashcards.at(-1);
    setMutationId(flashcard.id);
    setMutationError(undefined);
    setNotice(undefined);
    try {
      let deleted = false;
      try {
        deleted =
          (await sendMutation("DELETE", { id: flashcard.id, updatedAt: flashcard.updatedAt })).deletedId ===
          flashcard.id;
      } catch (caught) {
        const code = caught instanceof Error ? caught.message : "delete_failed";
        if (code !== "mutation_ambiguous") throw caught;
        const rebuilt = await rebuildLoadedWindow(boundary);
        const current = rebuilt.find((card) => card.id === flashcard.id);
        if (!current) deleted = true;
        else throw new Error(current.updatedAt !== flashcard.updatedAt ? "mutation_conflict" : "mutation_ambiguous");
      }
      if (!deleted) throw new Error("delete_failed");
      setFlashcards((current) => current.filter((card) => card.id !== flashcard.id));
      if (editingId === flashcard.id) {
        setEditingId(null);
        setEditorDirty(false);
      }
      setDeleteRequest(undefined);
      setNotice("Flashcard deleted.");
      focusAfterDelete();
    } catch (caught) {
      setMutationError({
        id: flashcard.id,
        message: messageFor(
          caught instanceof Error ? caught.message : undefined,
          "The flashcard could not be deleted.",
        ),
      });
      setDeleteRequest(undefined);
      requestAnimationFrame(() => {
        deleteRequest.trigger.focus();
      });
    } finally {
      setMutationId(null);
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
          editingId={editingId}
          mutationId={mutationId}
          mutationError={mutationError}
          onAdd={() => {
            setFormOpen(true);
          }}
          onEdit={beginEdit}
          onDirtyChange={setEditorDirty}
          onCancelEdit={() => {
            setEditingId(null);
            setEditorDirty(false);
            setMutationError(undefined);
          }}
          onSave={update}
          onRequestDelete={(flashcard, trigger, focusAfterDelete) => {
            setDeleteRequest({ flashcard, trigger, focusAfterDelete });
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
            disabled={loadingMore || saving || initialLoading || reconciling}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore && <LoaderCircle className="size-4 animate-spin" />}
            {loadingMore ? "Loading…" : paginationError ? "Try Load More again" : "Load More"}
          </button>
        </div>
      )}
      <FlashcardDeleteDialog
        open={Boolean(deleteRequest)}
        busy={deleteRequest?.flashcard.id === mutationId}
        onCancel={cancelDelete}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
