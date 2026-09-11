# AI generation reference facts

Status: **APPROVED**  
Drafted: 2026-09-11  
Human approval: **Maciek — approved without changes**  
Approval date: **2026-09-11**

These expectations were derived from the synthetic source texts before any model output was generated. Paragraph
anchors count non-empty paragraphs from the top of each source as P1, P2, and so on. Any edit to a source or its facts,
acceptable paraphrases, forbidden inversions, or key concepts invalidates approval for that sample until a human
reviews the changed revision again.

## `factual-en` revision 1

- Language: English
- Source: `sources/factual-en.txt`
- Key concepts: queue-local job identity; lease authorization and timing; terminal job state; notification
  idempotency; retention and queue deletion.

| ID    | Source | Expected fact                                                                                                            | Acceptable paraphrases                              | Forbidden inversion or invention                                |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------- |
| FE-01 | P1     | Each accepted job receives a sequential number unique within its queue, not globally.                                    | Different queues may reuse the same job number.     | Job numbers are globally unique.                                |
| FE-02 | P2     | A worker leases one waiting job at a time, and progress, completion, and extension require the lease token.              | The token authorizes all three lease operations.    | A worker may report completion without a token.                 |
| FE-03 | P2     | A valid extension adds 60 seconds from acceptance; an expired lease cannot be extended.                                  | Extension timing is based on acceptance time.       | Extension adds time to the former expiry or works after expiry. |
| FE-04 | P3     | All steps must succeed for job success; one failed step makes the job fail immediately.                                  | Success requires every listed step.                 | A later successful step can recover a failed job.               |
| FE-05 | P3     | Lease loss returns a job to waiting instead of failing it, and the old token is rejected.                                | Another worker may lease the returned job.          | Lease expiry permanently fails the job.                         |
| FE-06 | P4     | One notification is sent on the first terminal success or failure; expiry/requeue and repeated completion do not notify. | Terminal notification is idempotent.                | Every repeated report or lease expiry sends a notification.     |
| FE-07 | P5     | Final status, step results, and notification outcome are retained for 14 days and then deleted together.                 | Completion records share a 14-day retention period. | Commit and environment are archived permanently.                |
| FE-08 | P5     | Deleting a queue immediately removes its jobs but never another queue with the same display name.                        | Queue deletion is scoped by queue identity.         | Equal display names cause both queues to be deleted.            |

## `conditions-pl` revision 1

- Language: Polish
- Source: `sources/conditions-pl.txt`
- Key concepts: generation-aware writes and reads; protected deletion exception; conditional response disclosure;
  one-way replication and promotion; read-only maintenance behavior.

| ID    | Source | Expected fact                                                                                          | Acceptable paraphrases                         | Forbidden inversion or invention                                 |
| ----- | ------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| CP-01 | P1     | Nadpisanie klucza tworzy nową generację i zachowuje termin wygaśnięcia, o ile żądanie nie poda nowego. | Termin zmienia się tylko na jawne żądanie.     | Każdy zapis automatycznie odnawia termin.                        |
| CP-02 | P1     | Odczyt zwraca tylko najnowszą niewygasłą generację.                                                    | Starsza generacja nie jest wynikiem odczytu.   | Można odczytać dowolną wcześniejszą generację.                   |
| CP-03 | P2     | Chroniony wpis można ręcznie usunąć tylko z jednorazowym kodem i numerem najnowszej generacji.         | Oba warunki są konieczne.                      | Wystarcza autorstwo, sam kod albo numer starszej generacji.      |
| CP-04 | P2     | Automatyczne wygaśnięcie usuwa także chroniony wpis bez kodu.                                          | Ochrona nie blokuje expiry.                    | Chroniony wpis nigdy nie wygasa.                                 |
| CP-05 | P3     | Przy niezgodnej generacji odczyt warunkowy ujawnia aktualny numer, ale nie wartość.                    | Zgodność zwraca wartość i „bez zmian”.         | Niezgodność ujawnia wartość.                                     |
| CP-06 | P3     | Brakujący lub wygasły wpis daje „brak” bez ostatniego numeru generacji.                                | Wygasły wpis zachowuje się jak nieistniejący.  | Odpowiedź „brak” ujawnia dawną generację.                        |
| CP-07 | P4     | Replikacja biegnie z głównego do zapasowego do 30 sekund; zapasowy zapisuje dopiero po promocji.       | Promocja zmienia region główny.                | Replika zawsze przyjmuje zapis albo synchronizuje w obie strony. |
| CP-08 | P4     | Po promocji system nie scala automatycznie zmian z dawnego regionu głównego.                           | Konflikty nie są automatycznie łączone.        | Promocja uruchamia automatyczny merge.                           |
| CP-09 | P5     | Tryb tylko do odczytu dopuszcza odczyty i expiry, lecz odrzuca zapis, ręczne usunięcie i promocję.     | Wygasłe wpisy nie wracają po wyłączeniu trybu. | Tryb zatrzymuje expiry albo pozwala promować region.             |

## `sparse-pl` revision 1

- Language: Polish
- Source: `sources/sparse-pl.txt`
- Key concepts: nagłówek; sekcja danych; pieczęć. A small result is expected; do not invent additional concepts to
  reach five cards.

| ID    | Source | Expected fact                                                                                                                 | Acceptable paraphrases                               | Forbidden inversion or invention                                        |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| SP-01 | P1     | Nagłówek zaczyna pakiet, podaje nazwę i rewizję, ale nie zawiera wykonywanych ustawień.                                       | Nagłówek identyfikuje pakiet i wersję dla człowieka. | Nagłówek zastępuje sekcję danych.                                       |
| SP-02 | P2     | Dokładnie jedna sekcja danych leży po nagłówku; kolejność unikalnych kluczy jest znacząca.                                    | Te same pary w innej kolejności tworzą inną sekcję.  | Kolejność nie ma znaczenia albo klucz może się powtarzać.               |
| SP-03 | P2     | Wartości zawsze są tekstem, a sekcja może być pusta.                                                                          | Liczba wyglądająca jak tekst pozostaje tekstem.      | Pusty pakiet pomija sekcję danych lub pieczęć.                          |
| SP-04 | P3     | Pieczęć chroni dokładny nagłówek i dane; niezgodność unieważnia cały pakiet bez częściowej naprawy.                           | Odbiorca sprawdza pieczęć przed użyciem ustawień.    | Odbiorca może zastosować poprawnie wyglądające pary mimo złej pieczęci. |
| SP-05 | P4     | Format nie ma komentarzy, załączników, dziedziczenia ani dodatkowych sekcji.                                                  | Mewa składa się wyłącznie z trzech opisanych pojęć.  | Format obsługuje niewymienione elementy.                                |
| SP-06 | P4     | Nazwa i rewizja mogą być pokazane diagnostycznie przed weryfikacją, lecz dane wolno zastosować dopiero po poprawnej pieczęci. | Podgląd metadanych nie oznacza akceptacji pakietu.   | Wyświetlenie nagłówka pozwala zastosować dane bez weryfikacji.          |

## Human approval record

The reviewer must confirm all of the following before the first live run:

- [x] Each source is synthetic, self-contained, and accurately represented by its fact table.
- [x] Paragraph anchors, acceptable paraphrases, forbidden inversions, and key concepts are correct.
- [x] `sparse-pl` intentionally contains only the three named concepts and does not invite filler.
- [x] The rubric's fidelity criteria and batch-failure rule are acceptable.

Reviewer: **Maciek**  
Decision and corrections: **Approved without changes on 2026-09-11.**
