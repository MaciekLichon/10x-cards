import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FlashcardDeleteDialog({ open, busy, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => cancelRef.current?.focus());
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto max-w-md rounded-xl border border-white/15 bg-blue-950 p-0 text-white shadow-2xl backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 id="delete-dialog-title" className="text-xl font-semibold">
          Delete this flashcard?
        </h2>
        <p className="mt-2 text-sm text-blue-100/75">This action is permanent and cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none disabled:opacity-50"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? "Deleting…" : "Delete flashcard"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
