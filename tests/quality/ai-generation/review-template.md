# AI generation source-fidelity review

## Run identity

- Date and time:
- Reviewer:
- Application revision (`git rev-parse --short HEAD`):
- Sample ID and approved revision:
- Source language:
- Configured model identifier (never include keys):
- Attempt number for this sample and date:
- Provider outcome: `cards returned` / `no result — provider failure`
- Number of cards returned:
- Related prior failed-attempt record, if any:

## Approval prerequisite

- Reference approval date:
- Approved by:
- Confirmed source and reference revision unchanged: `yes` / `no`

If approval is absent or the revision changed, stop. Do not assess or label the result as pass.

## Unedited generated cards

Copy every returned card before editing. Synthetic approved source content and deliberately retained generated cards
may be stored here; never include private user text, secrets, tokens, logs, or the raw provider envelope.

### Card 1

- Question:
- Answer:

<!-- Repeat the card block until every returned card is captured. -->

## Per-card review

### Card 1

- Evidence: source paragraph(s) and reference fact ID(s):
- Source support: `pass` / `fail` / `unresolved` — reason:
- Answer correctness: `pass` / `fail` / `unresolved` — reason:
- Conditions and negation: `pass` / `fail` / `unresolved` — reason:
- Source-answerability: `pass` / `fail` / `unresolved` — reason:
- Card fidelity: `pass` / `fail` / `unresolved`
- Standalone question: `yes` / `no` — note:
- One concept: `yes` / `no` — note:
- Overlap with other cards:
- Source language preserved: `yes` / `no` — note:
- Needed edit:
- Usefulness decision: `accept` / `edit` / `reject` — reason:

<!-- Repeat the review block for every captured card. -->

## Batch summary

- Fidelity result: `pass` / `fail` / `unresolved` / `no result — provider failure`
- Failed or unresolved cards and decisive reasons:
- Covered reference fact IDs:
- Important omissions (descriptive; full coverage is not required):
- Overlap observations:
- Edits that would improve usefulness:
- Usefulness summary (descriptive; no percentage threshold):
- Retry decision if there was no provider result:

## Follow-up

- Human resolution owner for unresolved judgments:
- Local change path for each factual failure:
- Additional notes:
