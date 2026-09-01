---
change_id: spaced-repetition-session
research_type: external
library: ts-fsrs
source: Context7
created: 2026-08-31
updated: 2026-08-31
---

# TS-FSRS Context7 implementation reference

Context7 resolved the official package documentation as `/open-spaced-repetition/ts-fsrs` (source reputation: High,
447 indexed snippets, benchmark score: 88.42).

## Scheduling contract

Use FSRS v6 through `fsrs(generatorParameters(...))`. New flashcards begin with `createEmptyCard()`. The UI should
expose the package's native four-grade scale without an application-specific mapping:

| UI rating | `Rating` member | Numeric grade |
| --- | --- | --- |
| Again | `Rating.Again` | 1 |
| Hard | `Rating.Hard` | 2 |
| Good | `Rating.Good` | 3 |
| Easy | `Rating.Easy` | 4 |

Use `scheduler.repeat(card, reviewedAt)` only to preview the scheduling result of every possible rating. Apply the
user's selected rating with `scheduler.next(card, reviewedAt, rating)`. Calling `next` returns a `RecordLogItem`
containing the updated `card` and its corresponding `log`.

```ts
import { createEmptyCard, fsrs, generatorParameters, Rating } from "ts-fsrs";

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 36500,
    enable_fuzz: false,
    enable_short_term: true,
    learning_steps: ["1m", "10m"],
    relearning_steps: ["10m"],
  }),
);

const card = createEmptyCard();
const reviewedAt = new Date();

const preview = scheduler.repeat(card, reviewedAt);
const result = scheduler.next(card, reviewedAt, Rating.Good);

console.log(preview[Rating.Good].card.due);
console.log(result.card);
console.log(result.log);
```

`next` accepts grades 1 through 4. Passing `Rating.Manual` (0) or another invalid grade throws an
`FSRSValidationError`.

## Due-card selection and persistence

The application owns session selection: query the user's persisted cards whose `due` timestamp is at or before the
session cutoff. TS-FSRS schedules an individual card but does not replace this database query.

Persist both outputs of `scheduler.next` atomically:

1. Replace the flashcard's scheduling fields with `result.card`.
2. Insert `result.log` into the append-only review history.

The scheduling callback can convert JavaScript dates to database-safe timestamps at the boundary:

```ts
const persistedResult = scheduler.next(card, reviewedAt, rating, ({ card, log }) => ({
  card: {
    ...card,
    due: card.due.getTime(),
    last_review: card.last_review?.getTime() ?? null,
  },
  log: {
    ...log,
    due: log.due.getTime(),
    review: log.review.getTime(),
  },
}));
```

The documented `ReviewLog` includes the rating, state and due date before the review, previous stability and
difficulty, scheduled interval, learning step, and review time. This is sufficient to audit how each persisted card
state was produced.

## Configuration decision for S-05

Start with `generatorParameters()` defaults, including `request_retention: 0.9`, rather than maintaining a custom
21-element FSRS v6 weight array. `request_retention` controls the target recall probability, `maximum_interval` caps
the interval in days, `enable_fuzz` introduces small interval variations, and `enable_short_term` enables learning and
relearning steps.

For the MVP, keep the default weights fixed and persist the effective scheduler configuration or a configuration
version alongside the implementation. Changing parameters later without versioning would make scheduling behavior
harder to reproduce and audit.

## Context7 source pages

- [Basic scheduling example](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/README.md)
- [Scheduler API: `next`, `repeat`, and retrievability](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/_autodocs/01-scheduler-api.md)
- [Card, review-log, and configuration types](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/_autodocs/02-types.md)
- [Configuration and default FSRS v6 weights](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/_autodocs/04-configuration.md)
- [Serialization quick reference](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/_autodocs/08-quick-reference.md)
