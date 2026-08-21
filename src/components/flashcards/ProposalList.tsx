import type { EditableProposal } from "@/components/flashcards/ProposalCard";
import { isProposalValid, ProposalCard } from "@/components/flashcards/ProposalCard";

interface ProposalListProps {
  proposals: EditableProposal[];
  disabled: boolean;
  sparse: boolean;
  onChange: (id: string, field: "question" | "answer", value: string) => void;
  onToggle: (id: string) => void;
}

export function ProposalList({ proposals, disabled, sparse, onChange, onToggle }: ProposalListProps) {
  const acceptedCount = proposals.filter((proposal) => proposal.accepted).length;
  const validCount = proposals.filter((proposal) => proposal.accepted && isProposalValid(proposal)).length;

  return (
    <section aria-labelledby="review-heading" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="review-heading" className="text-xl font-bold text-white">
            Review proposals
          </h2>
          <p className="text-sm text-blue-100/60">
            Edit each accepted card or reject it. Rejected cards can be restored.
          </p>
        </div>
        <p className="text-sm font-medium text-blue-100" aria-live="polite">
          {acceptedCount} accepted / {proposals.length} total
          {acceptedCount !== validCount ? ` · ${validCount} valid` : ""}
        </p>
      </div>

      {sparse && (
        <p
          role="status"
          className="rounded-lg border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-100"
        >
          This source contained fewer than five distinct useful concepts, so no filler cards were added.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {proposals.map((proposal, index) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            index={index}
            disabled={disabled}
            onChange={onChange}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}
