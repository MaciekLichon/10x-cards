import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import ReviewCard from "@/components/review/ReviewCard";
import type { RateReviewInput, RateReviewResultDto, ReviewRating, ReviewSessionDto } from "@/lib/spaced-repetition";

type ViewState = "loading" | "ready" | "submitting" | "reconciling" | "failed";
interface ApiBody {
  error?: { code?: string; message?: string };
  session?: ReviewSessionDto;
  result?: RateReviewResultDto;
}
const NAMES: Record<ReviewRating, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

export default function SpacedRepetitionSession() {
  const [session, setSession] = useState<ReviewSessionDto>();
  const [view, setView] = useState<ViewState>("loading");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState<RateReviewInput>();
  const [now, setNow] = useState(0);
  const generation = useRef(0);

  const load = useCallback(async (reconciling = false): Promise<boolean> => {
    const requestGeneration = ++generation.current;
    setView(reconciling ? "reconciling" : "loading");
    setError(undefined);
    try {
      const response = await fetch("/api/review/session");
      const body: ApiBody = await response.json();
      if (!response.ok || !body.session)
        throw new Error(body.error?.message ?? "Your review session could not be loaded.");
      if (requestGeneration !== generation.current) return false;
      setSession(body.session);
      setPending(undefined);
      setNow(Date.now());
      setView("ready");
      return true;
    } catch (caught) {
      if (requestGeneration !== generation.current) return false;
      setError(caught instanceof Error ? caught.message : "Your review session could not be loaded.");
      setView("failed");
      return false;
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void load();
    });
    return () => {
      cancelAnimationFrame(frame);
      generation.current += 1;
    };
  }, [load]);

  const currentCard = session?.cards.find((card) => card.disposition === "ready");
  const waitingCard = session?.cards.find((card) => card.disposition === "waiting");
  const waitMs = waitingCard ? Math.max(0, Date.parse(waitingCard.due) - now) : 0;

  useEffect(() => {
    if (!waitingCard || currentCard || view !== "ready") return;
    if (waitMs === 0) {
      const frame = requestAnimationFrame(() => {
        void load(true);
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    }
    const timer = window.setTimeout(
      () => {
        setNow(Date.now());
      },
      Math.min(1_000, waitMs),
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [currentCard, load, view, waitMs, waitingCard]);

  useEffect(() => {
    function refreshWhenActive() {
      if (document.visibilityState === "visible" && session?.status === "active") void load(true);
    }
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
    };
  }, [load, session?.status]);

  const send = useCallback(
    async (payload: RateReviewInput) => {
      setView("submitting");
      setError(undefined);
      try {
        const response = await fetch("/api/review/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body: ApiBody = await response.json();
        if (response.ok && body.result) {
          setSession(body.result.session);
          setPending(undefined);
          setNotice(`${NAMES[body.result.rating]} saved. Progress confirmed.`);
          setNow(Date.now());
          setView("ready");
        } else if (response.status === 409) {
          setPending(undefined);
          if (body.session) {
            setSession(body.session);
            setNow(Date.now());
            setView("ready");
          } else if (!(await load(true))) {
            return;
          }
          setNotice("Progress changed in another tab. The latest session has been restored.");
        } else if (response.status >= 500 || body.error?.code === "review_ambiguous") {
          setPending(payload);
          setError("The rating result is uncertain. Retry to reconcile the same rating safely.");
          setView("failed");
        } else {
          setPending(undefined);
          setError(body.error?.message ?? "The rating could not be saved.");
          setView("failed");
        }
      } catch {
        setPending(payload);
        setError("The rating result is uncertain. Retry to reconcile the same rating safely.");
        setView("failed");
      }
    },
    [load],
  );

  function rate(rating: ReviewRating) {
    if (!session || !currentCard || view !== "ready") return;
    const payload = {
      requestId: crypto.randomUUID(),
      sessionId: session.id,
      cardId: currentCard.id,
      rating,
      expectedScheduleVersion: currentCard.scheduleVersion,
    };
    setPending(payload);
    void send(payload);
  }

  if (!session && (view === "loading" || view === "reconciling"))
    return (
      <p role="status" className="flex justify-center gap-2 py-20 text-blue-100/70">
        <LoaderCircle className="size-5 animate-spin" /> Loading your review session…
      </p>
    );
  if (!session)
    return <ErrorPanel message={error ?? "Your review session is unavailable."} onRetry={() => void load()} />;
  if (session.status === "empty")
    return (
      <Outcome title="You’re all caught up" description="No flashcards are due at this session’s cutoff.">
        <a href="/dashboard/collection" className={primary}>
          Open collection
        </a>
        <a href="/dashboard" className={secondary}>
          Return to workspace
        </a>
      </Outcome>
    );

  if (session.status === "completed" || (!currentCard && !waitingCard)) {
    const summary = session.summary;
    const counts = [summary.againCount, summary.hardCount, summary.goodCount, summary.easyCount];
    return (
      <Outcome
        title="Session complete"
        description={`You completed ${summary.reviewedCount} review${summary.reviewedCount === 1 ? "" : "s"}.`}
      >
        <dl className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {([1, 2, 3, 4] as ReviewRating[]).map((rating) => (
            <div key={rating} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <dt className="text-xs text-blue-100/60">{NAMES[rating]}</dt>
              <dd className="mt-1 text-xl font-semibold">{counts[rating - 1]}</dd>
            </div>
          ))}
        </dl>
        {summary.deferredCount > 0 && (
          <p className="text-sm text-blue-100/70">
            {summary.deferredCount} short-term card{summary.deferredCount === 1 ? " was" : "s were"} deferred to a later
            session.
          </p>
        )}
        <button type="button" onClick={() => void load()} className={primary}>
          Check for another due session
        </button>
        <a href="/dashboard" className={secondary}>
          Return to workspace
        </a>
      </Outcome>
    );
  }

  const progress = Math.round(
    ((session.summary.totalCount - session.summary.remainingCount) / session.summary.totalCount) * 100,
  );
  return (
    <div className="space-y-5">
      <div className="flex justify-between gap-4 text-sm text-blue-100/70">
        <span>
          {session.summary.remainingCount} of {session.summary.totalCount} remaining
        </span>
        <span>{progress}% complete</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div aria-live="polite" aria-atomic="true">
        {notice && (
          <p className="rounded-lg border border-emerald-400/25 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-100">
            {notice}
          </p>
        )}
      </div>
      {error && (
        <ErrorPanel
          message={error}
          onRetry={() => (pending ? void send(pending) : void load(true))}
          retryLabel={pending ? "Retry same rating" : "Retry"}
        />
      )}
      {view === "reconciling" && (
        <p role="status" className="flex items-center gap-2 text-sm text-blue-100/70">
          <LoaderCircle className="size-4 animate-spin" /> Refreshing session state…
        </p>
      )}
      {currentCard ? (
        <ReviewCard
          key={`${currentCard.id}-${currentCard.reviewCount}`}
          card={currentCard}
          busy={view !== "ready" || Boolean(pending)}
          onRate={rate}
        />
      ) : waitingCard ? (
        <div role="status" className="rounded-2xl border border-white/15 bg-white/8 p-8 text-center">
          <p className="text-lg font-semibold">Next card will be ready shortly</p>
          <p className="mt-2 text-blue-100/70">
            Ready in {Math.ceil(waitMs / 1_000)} second{Math.ceil(waitMs / 1_000) === 1 ? "" : "s"}. We’ll refresh
            automatically.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const primary =
  "inline-flex justify-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 font-semibold text-white focus-visible:ring-2 focus-visible:ring-purple-200 focus-visible:outline-none";
const secondary =
  "inline-flex justify-center rounded-xl border border-white/20 px-5 py-3 text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none";
function ErrorPanel({
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-900/25 p-5">
      <p role="alert" aria-live="assertive" className="text-red-100">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:outline-none"
      >
        <RefreshCw className="size-4" /> {retryLabel}
      </button>
    </div>
  );
}
function Outcome({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-5 rounded-2xl border border-white/15 bg-white/8 p-8 text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-blue-100/70">{description}</p>
      {children}
    </section>
  );
}
