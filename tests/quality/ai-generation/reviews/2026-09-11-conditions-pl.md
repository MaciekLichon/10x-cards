# AI generation source-fidelity review

## Run identity

- Date: 2026-09-11
- Reviewer: Maciek
- Application revision (`git rev-parse --short HEAD`): `a452a28`
- Sample ID and approved revision: `conditions-pl`, revision 1
- Source language: Polish
- Requested model/router identifier: `openrouter/free`
- Actual routed model identifier: `not captured during this run`
- Observed model display label: `Nex-N2.5-Mini (free)`
- Attempt number for this sample and date: attempt 1, 2026-09-11
- Provider outcome: `cards returned`
- Number of cards returned: 7
- Related prior failed-attempt record, if any: none

## Approval prerequisite

- Reference approval date: 2026-09-11
- Approved by: Maciek
- Confirmed source and reference revision unchanged: `yes`

## Unedited generated cards

### Card 1

- Question: Jak zapis istniejącego klucza wpływa na generację i wygaśnięcie?
- Answer: Tworzy nową generację klucza, ale pozostawia dotychczasowy czas wygaśnięcia, chyba że żądanie poda nowy
  czas.

### Card 2

- Question: Którą generację klucza zwraca zwykły odczyt?
- Answer: Tylko najnowszą generację, która jeszcze nie wygasła.

### Card 3

- Question: Jak można usunąć chroniony wpis?
- Answer: Tylko przez jednorazowy kod administracyjny zawierający numer najnowszej generacji. Zwykłe usunięcie jest
  niedozwolone; automatyczne wygaśnięcie działa niezależnie od ochrony.

### Card 4

- Question: Jak działa odczyt warunkowy z oczekiwaną generacją?
- Answer: Przy zgodnej generacji zwraca wartość i znacznik „bez zmian”. Przy niezgodnej zwraca wyłącznie aktualny
  numer generacji, bez wartości. Dla braku lub wygaśnięcia zwraca „brak” bez numeru generacji.

### Card 5

- Question: Jak działa replikacja i promocja regionu zapasowego?
- Answer: Zapis trafia z regionu głównego do zapasowego najwyżej po 30 sekundach. Zapasowy nie przyjmuje zapisów przed
  promocją. Po promocji nie następuje automatyczne scalanie zmian z dawnym regionem głównym.

### Card 6

- Question: Co jest dozwolone i niedozwolone w trybie tylko do odczytu?
- Answer: Odczyty, także warunkowe, oraz automatyczne wygaśnięcie działają. Zapisy, zwykłe usunięcia i promocja regionu
  są odrzucane.

### Card 7

- Question: Co dzieje się z wygasłymi wpisami po wyłączeniu trybu tylko do odczytu?
- Answer: Nie przywraca wpisów, które automatycznie wygasły podczas prac serwisowych.

## Per-card review

### Card 1

- Evidence: source P1; CP-01.
- Source support: `pass` — both claims are explicit in P1.
- Answer correctness: `pass` — a write creates a generation and preserves expiry unless a new expiry is supplied.
- Conditions and negation: `pass` — the explicit-new-expiry exception is retained.
- Source-answerability: `pass` — P1 is sufficient.
- Card fidelity: `pass`
- Standalone question: `yes`
- One concept: `yes`
- Overlap with other cards: none material.
- Source language preserved: `yes`
- Needed edit: none.
- Usefulness decision: `accept` — concise and complete for CP-01.

### Card 2

- Evidence: source P1; CP-02.
- Source support: `pass` — P1 states the returned generation.
- Answer correctness: `pass` — it identifies the latest unexpired generation.
- Conditions and negation: `pass` — the unexpired condition is retained.
- Source-answerability: `pass` — P1 is sufficient.
- Card fidelity: `pass`
- Standalone question: `yes`
- One concept: `yes`
- Overlap with other cards: none material.
- Source language preserved: `yes`
- Needed edit: none.
- Usefulness decision: `accept` — directly tests CP-02.

### Card 3

- Evidence: source P2; CP-03 and CP-04.
- Source support: `fail` — P2 says the request contains a one-time administrative code and the latest generation
  number; it does not say that the code contains the generation number.
- Answer correctness: `fail` — the response changes two separately required request elements into a containment
  relationship.
- Conditions and negation: `fail` — both requirements are mentioned, but their required relationship is materially
  altered. The automatic-expiry exception is preserved correctly.
- Source-answerability: `pass` — P2 gives a complete answer.
- Card fidelity: `fail`
- Standalone question: `yes`
- One concept: `yes` — protected deletion and its automatic-expiry exception.
- Overlap with other cards: no material overlap.
- Source language preserved: `yes`
- Needed edit: replace the first sentence with “Chroniony wpis można usunąć tylko wtedy, gdy żądanie zawiera
  jednorazowy kod administracyjny oraz numer najnowszej generacji.”
- Usefulness decision: `edit` — useful after correcting the relationship between the two required fields.

### Card 4

- Evidence: source P3; CP-05 and CP-06.
- Source support: `pass` — all three conditional outcomes are stated in P3.
- Answer correctness: `pass` — matching, mismatching, and missing/expired cases are distinguished correctly.
- Conditions and negation: `pass` — value disclosure and generation-number nondisclosure are preserved.
- Source-answerability: `pass` — P3 is sufficient.
- Card fidelity: `pass`
- Standalone question: `yes`
- One concept: `yes` — conditional read behavior.
- Overlap with other cards: none material.
- Source language preserved: `yes`
- Needed edit: none.
- Usefulness decision: `accept` — complete summary of CP-05 and CP-06.

### Card 5

- Evidence: source P4; CP-07 and CP-08.
- Source support: `pass` — P4 supports the replication delay, write restriction, promotion, and no-merge rule.
- Answer correctness: `pass` — direction and timing are accurate.
- Conditions and negation: `pass` — promotion is required before writes and does not trigger automatic merging.
- Source-answerability: `pass` — P4 is sufficient.
- Card fidelity: `pass`
- Standalone question: `yes`
- One concept: `yes` — standby replication and promotion behavior.
- Overlap with other cards: none material.
- Source language preserved: `yes`
- Needed edit: none.
- Usefulness decision: `accept` — preserves the key conditions of CP-07 and CP-08.

### Card 6

- Evidence: source P5; CP-09.
- Source support: `pass` — P5 explicitly divides allowed and rejected operations.
- Answer correctness: `pass` — reads and automatic expiry continue; writes, ordinary deletion, and promotion fail.
- Conditions and negation: `pass` — no operation is moved to the wrong side of the rule.
- Source-answerability: `pass` — P5 is sufficient.
- Card fidelity: `pass`
- Standalone question: `yes`
- One concept: `yes` — read-only mode operation policy.
- Overlap with other cards: Card 7 expands the post-maintenance consequence of automatic expiry.
- Source language preserved: `yes`
- Needed edit: none.
- Usefulness decision: `accept` — compactly tests the maintenance-mode rule.

### Card 7

- Evidence: source P5; CP-09.
- Source support: `pass` — P5 says disabling read-only mode does not restore expired entries.
- Answer correctness: `pass` — the persistence of expiry is represented accurately.
- Conditions and negation: `pass` — the non-restoration condition is retained.
- Source-answerability: `pass` — P5 is sufficient.
- Card fidelity: `pass`
- Standalone question: `yes`
- One concept: `yes`
- Overlap with other cards: partially overlaps Card 6 but adds the distinct post-maintenance consequence.
- Source language preserved: `yes`
- Needed edit: none.
- Usefulness decision: `accept` — the limited overlap still tests a separate consequence.

## Batch summary

- Fidelity result: `fail`
- Failed or unresolved cards and decisive reasons: Card 3 fails because it says the administrative code contains the
  latest generation number instead of requiring the request to contain both the code and that number separately.
- Covered reference fact IDs: CP-01 through CP-09.
- Important omissions: none against the approved reference inventory; full coverage was not required.
- Overlap observations: Cards 6 and 7 overlap on automatic expiry, but Card 7 adds the non-restoration outcome.
- Edits that would improve usefulness: correct Card 3's first sentence as recorded above.
- Usefulness summary: six cards `accept`, one card `edit`; all are standalone and use Polish. No numeric threshold was
  applied.
- Retry decision if there was no provider result: not applicable; a result was returned and no retry was performed.

## Follow-up

- Human resolution owner for unresolved judgments: none.
- Local change path for the factual failure: `context/changes/fix-protected-entry-deletion-card-fidelity/`.
- Additional notes: Maciek confirmed that this was the complete, unedited output from one run, that the cards were not
  saved to the collection, that Card 3 and the batch are fidelity `fail`, and that fidelity and usefulness were clearly
  separated without requiring additional rules.
