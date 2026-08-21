import { useMemo, useState } from "react";
import { LoaderCircle, Save, Sparkles } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import type { EditableProposal } from "@/components/flashcards/ProposalCard";
import { isProposalValid } from "@/components/flashcards/ProposalCard";
import { ProposalList } from "@/components/flashcards/ProposalList";
import { SourceTextInput } from "@/components/flashcards/SourceTextInput";
import { SOURCE_MAX_LENGTH, SOURCE_MIN_LENGTH, type FlashcardProposal } from "@/lib/flashcards";

type WorkflowStatus = "idle" | "generating" | "reviewing" | "saving" | "saved" | "error";

interface GenerateResponse {
  proposals?: FlashcardProposal[];
  sparse?: boolean;
  error?: { code?: string };
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_origin: "This request could not be verified. Refresh the page and try again.",
  unauthenticated: "Your session has expired. Sign in again to generate flashcards.",
  invalid_json: "The generation request was invalid. Please try again.",
  invalid_source: "Source text must contain 1,000 to 10,000 characters.",
  ai_not_configured: "AI generation is not configured for this environment.",
  unsupported_ai_configuration: "The configured AI model does not support the required output format.",
  provider_timeout: "Generation took too long. Your source text is preserved; please try again.",
  provider_failure: "AI generation is temporarily unavailable. Your source text is preserved.",
  malformed_output: "The AI returned an unreadable response. Your source text is preserved; please try again.",
  no_usable_proposals: "No useful flashcards could be generated from this source. Try more focused material.",
};

interface FlashcardWorkspaceProps {
  aiConfigured: boolean;
}

export default function FlashcardWorkspace({ aiConfigured }: FlashcardWorkspaceProps) {
  const [sourceText, setSourceText] = useState("");
  const [proposals, setProposals] = useState<EditableProposal[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [error, setError] = useState<string>();
  const [sourceError, setSourceError] = useState<string>();
  const [sparse, setSparse] = useState(false);
  const busy = status === "generating" || status === "saving";
  const acceptedValid = useMemo(
    () => proposals.filter((proposal) => proposal.accepted && isProposalValid(proposal)),
    [proposals],
  );

  function validateSource(): boolean {
    const length = sourceText.trim().length;
    if (length < SOURCE_MIN_LENGTH || length > SOURCE_MAX_LENGTH) {
      setSourceError("Source text must contain 1,000 to 10,000 characters after trimming.");
      return false;
    }
    setSourceError(undefined);
    return true;
  }

  async function generate() {
    if (!validateSource() || busy) return;
    if (proposals.length > 0 && !window.confirm("Generate a new set and discard your unsaved proposal edits?")) return;

    setStatus("generating");
    setError(undefined);
    try {
      const response = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText }),
      });
      const body: GenerateResponse = await response.json();
      if (!response.ok || !body.proposals) {
        throw new Error(body.error?.code ?? "provider_failure");
      }
      setProposals(body.proposals.map((proposal) => ({ ...proposal, id: crypto.randomUUID(), accepted: true })));
      setSparse(Boolean(body.sparse));
      setStatus("reviewing");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "provider_failure";
      setError(ERROR_MESSAGES[code] ?? "Generation failed. Your source text is preserved; please try again.");
      setStatus("error");
    }
  }

  function updateProposal(id: string, field: "question" | "answer", value: string) {
    setProposals((current) =>
      current.map((proposal) => (proposal.id === id ? { ...proposal, [field]: value } : proposal)),
    );
  }

  function toggleProposal(id: string) {
    setProposals((current) =>
      current.map((proposal) => (proposal.id === id ? { ...proposal, accepted: !proposal.accepted } : proposal)),
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <SourceTextInput
          value={sourceText}
          onChange={(value) => {
            setSourceText(value);
            setSourceError(undefined);
          }}
          disabled={busy}
          error={sourceError}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || !aiConfigured}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-purple-500 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "generating" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {status === "generating"
              ? "Generating flashcards…"
              : proposals.length > 0
                ? "Generate another set"
                : "Generate flashcards"}
          </button>
          {proposals.length > 0 && (
            <span className="text-sm text-blue-100/50">A new generation replaces unsaved edits.</span>
          )}
        </div>
      </section>

      <div aria-live="polite" aria-atomic="true" className="min-h-6 text-sm text-blue-100/70">
        {status === "generating" && "Generating 5–15 focused proposals. This usually takes 10–15 seconds."}
        {status === "reviewing" &&
          `${proposals.length} proposal${proposals.length === 1 ? " is" : "s are"} ready to review.`}
        {status === "saving" && "Saving the selected cards…"}
        {status === "saved" && "Selected cards were saved."}
      </div>
      <ServerError message={error} />

      {proposals.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <ProposalList
            proposals={proposals}
            disabled={busy || status === "saved"}
            sparse={sparse}
            onChange={updateProposal}
            onToggle={toggleProposal}
          />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <p className="text-sm text-blue-100/60">
              {acceptedValid.length === 0
                ? "No accepted valid cards remain. This is a valid no-save outcome."
                : `${acceptedValid.length} valid card${acceptedValid.length === 1 ? "" : "s"} selected.`}
            </p>
            <button
              type="button"
              disabled
              title="Saving is added in Phase 3"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="size-4" />
              Save selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
