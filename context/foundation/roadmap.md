---
project: 10xCards
version: 1
status: draft
created: 2026-08-09
updated: 2026-08-09
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: 10xCards

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Programista chce szybko zamieniać wiedzę z artykułów, dokumentacji i kursów w wysokiej jakości fiszki do regularnych
powtórek. Produkt ma skrócić czasochłonne ręczne opracowywanie materiału dzięki propozycjom generowanym przez AI,
pozostawiając użytkownikowi kontrolę nad tym, co trafia do jego kolekcji.

## North star

W tej roadmapie **north star — najmniejszy pełny przepływ, którego dostarczenie potwierdzi, że produkt rozwiązuje
główny problem — to S-02: użytkownik może wygenerować, zweryfikować i zapisać fiszki z własnego tekstu.** Jest
umieszczony tak wcześnie, jak pozwalają zależności, ponieważ bez niego nie da się sprawdzić akceptacji ani udziału
fiszek tworzonych z AI.

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                                                       | Prerequisites | PRD refs                              | Status   |
| ---- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------- | -------- |
| F-01 | user-owned-flashcard-persistence | (foundation) minimalny kontrakt trwałego zapisu fiszek użytkownika i weryfikacja izolacji danych są gotowe | —             | NFR: izolacja danych, Access Control  | ready    |
| S-01 | account-access                   | użytkownik może utworzyć konto, zalogować się i wejść do chronionej części aplikacji                       | —             | FR-001, FR-002                        | ready    |
| S-02 | ai-flashcard-review              | użytkownik może wkleić tekst, wygenerować propozycje, poprawić je i zapisać wybrane fiszki                 | F-01, S-01    | US-01, FR-003, FR-004, FR-005, FR-006 | blocked  |
| S-03 | personal-flashcard-collection    | użytkownik może utworzyć fiszkę ręcznie i przeglądać własną kolekcję                                       | F-01, S-01    | FR-007, FR-008                        | proposed |
| S-04 | maintain-flashcard-collection    | użytkownik może poprawić albo usunąć istniejącą fiszkę ze swojej kolekcji                                  | S-03          | FR-009, FR-010                        | proposed |
| S-05 | spaced-repetition-session        | użytkownik może przejść sesję należnych powtórek, ocenić fiszki i zachować postęp                          | F-01, S-02    | US-01, FR-011, FR-012                 | blocked  |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph
below; this table is the proposed reading order across parallel tracks.

| Stream | Theme               | Chain                                        | Note                                                                                                |
| ------ | ------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A      | Dostęp do aplikacji | `S-01`                                       | Obecny przepływ konta otwiera wszystkie funkcje wymagające zalogowania.                             |
| B      | Fiszki i nauka      | `F-01` → (`S-02` → `S-05` / `S-03` → `S-04`) | Łączy się ze strumieniem A przy `S-02` i `S-03`; pierwszeństwo ma najkrótsza droga do działania AI. |

## Baseline

What's already in place in the codebase as of `2026-08-09` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro, React i Tailwind są skonfigurowane i używane przez strony oraz interaktywne formularze.
- **Backend / API:** present — działa rendering serwerowy i endpointy uwierzytelniania; pozostałe API nie istnieje.
- **Data:** partial — Supabase/PostgreSQL są skonfigurowane, ale brak migracji, schematu fiszek i kodu dostępu do danych.
- **Auth:** present — działają rejestracja, logowanie, wylogowanie, sesje i ochrona `/dashboard`.
- **Deploy / infra:** partial — adapter Cloudflare i Wrangler są skonfigurowane; automatyzacja działa poza repo przez Workers Builds, bez GitHub Actions.
- **Observability:** partial — włączono utrwalane logi Cloudflare, ale brak aplikacyjnego monitoringu błędów i metryk.

## Foundations

### F-01: Minimalny kontrakt danych fiszek

- **Outcome:** (foundation) minimalny kontrakt trwałego zapisu fiszek użytkownika i weryfikacja izolacji danych są gotowe.
- **Change ID:** user-owned-flashcard-persistence
- **PRD refs:** NFR: izolacja danych, Access Control
- **Unlocks:** S-02, S-03 i S-05; ścieżka weryfikacji, że użytkownik widzi wyłącznie własne fiszki.
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Fundament jest ograniczony do własności i trwałości danych potrzebnych pierwszym przepływom; pełny model powtórek pozostaje w S-05.
- **Status:** ready

## Slices

### S-01: Dostęp do chronionej aplikacji

- **Outcome:** użytkownik może utworzyć konto, zalogować się i wejść do chronionej części aplikacji.
- **Change ID:** account-access
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Funkcja istnieje w stanie bazowym, ale przed uznaniem jej za zamkniętą trzeba potwierdzić pełne zachowanie wymagane przez PRD.
- **Status:** ready

### S-02: Generowanie i weryfikacja fiszek AI

- **Outcome:** użytkownik może wkleić tekst, wygenerować propozycje, poprawić je i zapisać wybrane fiszki.
- **Change ID:** ai-flashcard-review
- **PRD refs:** US-01, FR-003, FR-004, FR-005, FR-006
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:**
  - Jaki dokładnie format i ograniczenia mają mieć wygenerowane fiszki? — Owner: user. Block: yes.
  - Jaki maksymalny rozmiar tekstu obejmuje cel generowania w 10–15 sekund? — Owner: user. Block: no.
- **Risk:** To najwcześniejsza ścieżka sprawdzająca wartość AI; nieustalony kontrakt wyniku uniemożliwia jej rzetelne zaplanowanie.
- **Status:** blocked

### S-03: Ręczne tworzenie i przeglądanie kolekcji

- **Outcome:** użytkownik może utworzyć fiszkę ręcznie i przeglądać własną kolekcję.
- **Change ID:** personal-flashcard-collection
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Przepływ potwierdza trwałość i izolację danych bez zależności od AI, ale nie powinien wyprzedzać prac odblokowujących S-02.
- **Status:** proposed

### S-04: Utrzymanie kolekcji fiszek

- **Outcome:** użytkownik może poprawić albo usunąć istniejącą fiszkę ze swojej kolekcji.
- **Change ID:** maintain-flashcard-collection
- **PRD refs:** FR-009, FR-010
- **Prerequisites:** S-03
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Edycja i usuwanie korzystają z kolekcji dostarczonej w S-03; wcześniejsza realizacja powielałaby ten sam przepływ bez wartości dla użytkownika.
- **Status:** proposed

### S-05: Sesja zaplanowanych powtórek

- **Outcome:** użytkownik może przejść sesję należnych powtórek, ocenić fiszki i zachować postęp do następnej sesji.
- **Change ID:** spaced-repetition-session
- **PRD refs:** US-01, FR-011, FR-012
- **Prerequisites:** F-01, S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - Jak użytkownik ocenia znajomość fiszki podczas sesji? — Owner: user. Block: yes.
  - Jaki gotowy algorytm spaced repetition wyznacza kolejny termin i jak interpretuje ocenę? — Owner: user. Block: yes.
- **Risk:** Utrata postępu lub błędny dobór kart narusza kryteria bezpieczeństwa produktu, dlatego oba kontrakty muszą być rozstrzygnięte przed planowaniem.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                        | Suggested issue title                                 | Ready for `/10x-plan` | Notes                                            |
| ---------- | -------------------------------- | ----------------------------------------------------- | --------------------- | ------------------------------------------------ |
| F-01       | user-owned-flashcard-persistence | Ustanów minimalny bezpieczny zapis fiszek użytkownika | yes                   | Odblokowuje S-02, S-03 i S-05.                   |
| S-01       | account-access                   | Zweryfikuj dostęp do chronionej aplikacji             | yes                   | Zachowanie jest już obecne w stanie bazowym.     |
| S-02       | ai-flashcard-review              | Dostarcz generowanie i weryfikację fiszek AI          | no                    | Najpierw ustal format i ograniczenia propozycji. |
| S-03       | personal-flashcard-collection    | Dodaj ręczne tworzenie i przeglądanie kolekcji        | no                    | Wymaga F-01 i S-01.                              |
| S-04       | maintain-flashcard-collection    | Dodaj edycję i usuwanie fiszek                        | no                    | Wymaga S-03.                                     |
| S-05       | spaced-repetition-session        | Dostarcz sesję zaplanowanych powtórek                 | no                    | Najpierw ustal skalę ocen i algorytm powtórek.   |

## Open Roadmap Questions

1. **Jaki dokładnie format i ograniczenia mają mieć wygenerowane fiszki?** — Owner: user. Block: S-02.
2. **Jak użytkownik ocenia znajomość fiszki podczas sesji?** — Owner: user. Block: S-05.
3. **Jaki gotowy algorytm spaced repetition wyznacza kolejny termin i jak interpretuje ocenę?** — Owner: user. Block: S-05.
4. **Jaki maksymalny rozmiar tekstu obejmuje cel generowania w 10–15 sekund?** — Owner: user. Block: —.
5. **Jak reguły generowania i powtórek powinny zmienić się przy wzroście skali do około 10 000 użytkowników?** — Owner: user. Block: —.
6. **Jakie są oczekiwane wolumen danych i szczytowa liczba żądań po uruchomieniu?** — Owner: user. Block: —.

## Parked

- **Własny zaawansowany algorytm powtórek** — Why parked: PRD §Non-Goals wymaga gotowego rozwiązania w MVP.
- **Import PDF, DOCX i innych formatów** — Why parked: PRD §Non-Goals ogranicza wejście do wklejanego tekstu.
- **Współdzielenie fiszek i kolekcji** — Why parked: PRD §Non-Goals wyklucza funkcje współpracy.
- **Integracje z platformami edukacyjnymi** — Why parked: PRD §Non-Goals odkłada integracje poza MVP.
- **Aplikacja mobilna** — Why parked: PRD §Non-Goals definiuje MVP jako desktopową aplikację webową.
- **Rozbudowany monitoring aplikacyjny** — Why parked: cel szybkiego uruchomienia i działające logi platformy nie uzasadniają osobnego fundamentu przed pierwszym przepływem.

## Done
