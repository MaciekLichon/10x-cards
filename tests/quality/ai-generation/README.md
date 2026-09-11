# Manual AI generation quality review

This directory contains a small, synthetic corpus for selectively checking whether generated flashcards preserve
source meaning. It complements deterministic Vitest coverage; it is not part of `npm run test`, a benchmark, or a
claim that all model output is correct.

## Artifacts

- `sources/factual-en.txt` — ordinary English facts, revision 1.
- `sources/conditions-pl.txt` — Polish conditions, negation, and exceptions, revision 1.
- `sources/sparse-pl.txt` — intentionally few Polish concepts, revision 1.
- `reference-facts.md` — pre-generation expectations and human approval record.
- `rubric.md` — separate fidelity verdicts from descriptive usefulness observations.
- `review-template.md` — copy for each attempt.
- `reviews/YYYY-MM-DD-<sample-id>.md` — retained completed review or provider-failure record.

Only synthetic samples explicitly approved in `reference-facts.md` may be used. Editing a source, its fact table, or
the rubric after approval requires a new revision and renewed human approval before generation.

## First and later reviews

1. A human reads all three sources, their expected facts, acceptable paraphrases, forbidden inversions, and the rubric.
   Correct them as needed, then replace the draft/pending fields in `reference-facts.md` and `rubric.md` with the
   reviewer's name or identifier, decision, and approval date.
2. Confirm the chosen sample's approved revision is unchanged. In an existing configured environment, run
   `npm run dev`, sign in, and open `/dashboard`.
3. Paste the complete chosen source, generate exactly one set, and copy every question and answer before making edits.
   Do not save these cards to the collection and do not retain the raw provider envelope.
4. Copy `review-template.md` to `reviews/YYYY-MM-DD-<sample-id>.md`. Record the application revision, configured model
   identifier, source revision, all unedited cards, source evidence, every per-card rubric result, batch fidelity, and
   descriptive usefulness.
5. If the provider fails, save the attempt as `no result — provider failure`. This is neither fidelity pass nor fail and
   does not satisfy the rollout's completed-review criterion. Do not repeat until the failure and the human decision to
   retry are recorded; a retry is a separate review file.
6. Do not discard, rename, or replace an unfavorable set. A contradiction, unsupported answer, or source-unanswerable
   question fails the card and batch. Preserve the evidence and open a separate local change under `context/changes/`,
   linked from the review. Do not tune the prompt or model as part of this assessment.
7. Ask the human reviewer to confirm that fidelity and usefulness were recorded separately and that these instructions
   were sufficient without additional rules. Then update the Phase 3 cookbook entry with the review path and result.

One completed live review is required for this rollout. Later reviews are selective: repeat after a prompt or model
change, or when a content-quality problem is reported. They are not required after every edit.

## Data handling

Committed artifacts may contain only approved synthetic sources and deliberately retained outputs from their review.
Never store private user material, credentials, tokens, environment values, screenshots containing personal data,
production logs, or raw provider payloads. The configured model identifier is required; the provider key is forbidden.

AI-assisted judging is not installed or selected. Consider it only after calibration against human labels shows useful
additional signal. Do not use it for deterministic format checks, cheap direct human review, or uncalibrated decisions.
Decision checked: 2026-09-11.
