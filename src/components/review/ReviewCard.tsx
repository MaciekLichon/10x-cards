import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import ReviewControls from "@/components/review/ReviewControls";
import type { ReviewCardDto, ReviewRating } from "@/lib/spaced-repetition";

interface Props {
  card: ReviewCardDto;
  busy: boolean;
  onRate: (rating: ReviewRating) => void;
}

export default function ReviewCard({ card, busy, onRate }: Props) {
  const [revealed, setRevealed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ratingGroupRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => headingRef.current?.focus());
  }, [card.id, card.reviewCount]);

  useEffect(() => {
    if (!revealed) return;
    const frame = requestAnimationFrame(() => {
      ratingGroupRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [revealed]);

  function reveal() {
    setRevealed(true);
  }

  return (
    <article className="rounded-2xl border border-white/15 bg-white/8 p-6 shadow-2xl shadow-purple-950/20 sm:p-8">
      <p className="text-xs font-semibold tracking-widest text-purple-200 uppercase">Question</p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 text-2xl leading-relaxed font-semibold whitespace-pre-wrap text-white focus:outline-none"
      >
        {card.front}
      </h2>
      {!revealed ? (
        <button
          type="button"
          onClick={reveal}
          disabled={busy}
          className="mt-8 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 font-semibold text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-purple-200 focus-visible:outline-none disabled:opacity-50"
        >
          Reveal answer
        </button>
      ) : (
        <>
          <div className="mt-8 border-t border-white/15 pt-6">
            <p className="text-xs font-semibold tracking-widest text-blue-200 uppercase">Answer</p>
            <p className="mt-3 text-lg leading-relaxed whitespace-pre-wrap text-blue-50">{card.back}</p>
          </div>
          <ReviewControls busy={busy} groupRef={ratingGroupRef} onRate={onRate} />
          {busy && (
            <p role="status" className="mt-4 flex items-center gap-2 text-sm text-blue-100/70">
              <LoaderCircle className="size-4 animate-spin" /> Saving your rating…
            </p>
          )}
        </>
      )}
    </article>
  );
}
