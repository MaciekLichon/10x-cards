import { ANSWER_MAX_LENGTH, SOURCE_MAX_LENGTH, SOURCE_MIN_LENGTH } from "@/lib/flashcards";

interface SourceTextInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}

export function SourceTextInput({ value, onChange, disabled, error }: SourceTextInputProps) {
  const count = value.trim().length;
  const descriptionId = error ? "source-error source-guidance source-count" : "source-guidance source-count";

  return (
    <div>
      <label htmlFor="source-text" className="mb-2 block text-sm font-semibold text-blue-100">
        Source text
      </label>
      <p id="source-guidance" className="mb-3 text-sm text-blue-100/60">
        Paste focused learning material with enough context for standalone questions. The generated cards stay in this
        browser until you save them. Answers can contain up to {ANSWER_MAX_LENGTH} characters.
      </p>
      <textarea
        id="source-text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        disabled={disabled}
        rows={12}
        maxLength={SOURCE_MAX_LENGTH + 1}
        aria-describedby={descriptionId}
        aria-invalid={Boolean(error)}
        placeholder="Paste an article, lesson, or documentation excerpt here…"
        className="w-full resize-y rounded-xl border border-white/15 bg-slate-950/40 px-4 py-3 text-sm leading-6 text-white placeholder:text-white/30 focus:border-purple-300 focus:ring-2 focus:ring-purple-300/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-xs">
        <div>
          {error ? (
            <p id="source-error" role="alert" className="text-red-300">
              {error}
            </p>
          ) : (
            <p className="text-blue-100/50">
              Use {SOURCE_MIN_LENGTH.toLocaleString()}–{SOURCE_MAX_LENGTH.toLocaleString()} characters.
            </p>
          )}
        </div>
        <p
          id="source-count"
          className={count < SOURCE_MIN_LENGTH || count > SOURCE_MAX_LENGTH ? "text-amber-300" : "text-emerald-300"}
          aria-live="polite"
        >
          {count.toLocaleString()} / {SOURCE_MAX_LENGTH.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
