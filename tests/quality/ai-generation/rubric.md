# Source-fidelity review rubric

Status: **APPROVED**  
Revision: 1  
Drafted: 2026-09-11  
Human approval: **Maciek — approved without changes**  
Approval date: **2026-09-11**

Use this rubric only with the source and matching approved revision in `reference-facts.md`. Review the unedited cards
from one generation run. Structural validity, card count, model confidence, and agreement with outside knowledge do not
establish fidelity.

## Fidelity verdict per card

Record `pass`, `fail`, or `unresolved` for each criterion.

| Criterion               | Pass                                                                      | Fail                                                               | Unresolved                                                     |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Source support          | Every material claim in the answer is supported by the source.            | A claim is absent from or contradicts the source.                  | The reviewer cannot decide from the approved source and facts. |
| Answer correctness      | The answer states the supported rule accurately.                          | The answer changes the rule, entity, quantity, timing, or outcome. | Wording permits multiple materially different readings.        |
| Conditions and negation | All relevant conditions, exceptions, limits, and negations are preserved. | A qualifier is dropped, inverted, generalized, or invented.        | It is unclear whether a qualifier is material.                 |
| Source-answerability    | The question can be answered from the source alone.                       | Answering requires outside facts or guessing.                      | The source anchor or question scope is ambiguous.              |

A card's fidelity verdict is `pass` only when all four criteria pass. Any criterion marked `fail` makes the card and
the entire batch fidelity verdict `fail`. Any `unresolved` criterion keeps the card and batch `unresolved` until a human
records a decision; it is never treated as pass. A failed assessment is a valid assessment result and must not be
renamed or replaced by a more favorable run.

## Usefulness observations

Record these separately. They do not change a fidelity pass into fail or a fidelity fail into pass.

- Is the question standalone, without hidden references such as “it” or “the system above”?
- Does the card test one concept?
- Which other cards substantially overlap it?
- Does the card use the source language?
- Which important reference facts were omitted from the batch?
- What edit, if any, would make the card useful?
- Reviewer decision: `accept`, `edit`, or `reject`, with a reason.

There is no required card count, full-coverage requirement, or numeric usefulness threshold. The PRD's 75% acceptance
goal is a product metric, not this review's pass threshold.

## Batch disposition and follow-up

Record one fidelity result: `pass`, `fail`, `unresolved`, or `no result — provider failure`. Provider failure is not a
semantic verdict. Do not retry without recording the failed attempt and an explicit decision to perform another,
separately dated run.

For a factual `fail`, retain the source anchor and unedited card in the review. Open a separate local change under
`context/changes/` and link it from the review; do not create a remote issue or tune the prompt/model in this rollout.
For `unresolved`, name the disputed criterion and human owner, then leave the batch unresolved until that owner decides.

AI-assisted judging is not part of this procedure. It may be reconsidered only after comparison with human-labeled
faithful and deliberately corrupted examples demonstrates additional signal. **When NOT to use AI:** deterministic
format validation, an affordable direct human review, or any review without calibration. Checked: 2026-09-11.
