import type { ReviewRating } from "@/lib/spaced-repetition";

const RATINGS: { value: ReviewRating; label: string; hint: string }[] = [
  { value: 1, label: "Again", hint: "I did not remember" },
  { value: 2, label: "Hard", hint: "I remembered with difficulty" },
  { value: 3, label: "Good", hint: "I remembered" },
  { value: 4, label: "Easy", hint: "I remembered easily" },
];

interface Props {
  busy: boolean;
  groupRef: React.RefObject<HTMLFieldSetElement | null>;
  onRate: (rating: ReviewRating) => void;
}

export default function ReviewControls({ busy, groupRef, onRate }: Props) {
  return (
    <fieldset ref={groupRef} tabIndex={-1} className="mt-6 focus:outline-none" disabled={busy}>
      <legend className="mb-3 text-sm font-medium text-blue-100">How well did you remember?</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RATINGS.map(({ value, label, hint }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              onRate(value);
            }}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left transition hover:border-purple-300/60 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block font-semibold text-white">{label}</span>
            <span className="mt-1 block text-xs text-blue-100/60">{hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
