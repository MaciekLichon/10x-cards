# AI generation validity — Implementation Plan

## Overview

Dostarczamy etap 1 z `context/foundation/test-plan.md`: powtarzalne testy odrzucania nieużytecznych odpowiedzi AI
i odzyskiwania po błędach oraz materiały i procedurę niezależnej oceny wierności fiszek względem źródła.
Trzy fazy poniżej są fazami wykonawczymi tego jednego etapu rolloutowego.

Plan uzgodniono 2026-09-08 na podstawie [research.md](research.md), [change.md](change.md) i pięciu odpowiedzi użytkownika,
a podczas przeglądu planu rozszerzono odbiór ryzyka #2 o pierwszy rzeczywisty przebieg generowania i ocenę człowieka.
Ukończenie planu oznacza zapisanie wyniku tej ograniczonej próby, nie szerokie potwierdzenie jakości merytorycznej modelu.

## Current State Analysis

Endpoint `src/pages/api/flashcards/generate.ts:11` sprawdza żądanie, wywołuje adapter OpenRouter i zwraca
propozycje lub stabilny kod błędu. Adapter dekoduje kopertę i wewnętrzny JSON, a `parseProposals`
filtruje kandydatów, usuwa znormalizowane duplikaty i ogranicza wynik do 15 kart.
Żaden element tej ścieżki nie porównuje znaczenia odpowiedzi z tekstem źródłowym.

Workspace zachowuje tekst i poprzednie propozycje podczas nieudanego generowania, a zastępuje je dopiero po sukcesie.
Brakuje automatycznej weryfikacji tej właściwości. Istnieją dwa zestawy SQL i trzy skrypty sprawdzające bazę i powtórki,
ale nie ma runnera ani komendy testów aplikacji.

Komunikat o małym zestawie przypisuje wynik ubogiej zawartości tekstu, choć liczba kart może zmaleć także wskutek
odfiltrowania niepoprawnych propozycji. Wcześniejsze ręczne wyniki PASS nie zawierają materiałów pozwalających
ponownie ocenić wierność.

## Desired End State

- Jedna lokalna komenda uruchamia deterministyczne testy API i komponentu bez kluczy AI, bazy, serwera aplikacji
  ani połączeń z usługami zewnętrznymi.
- Testy wykorzystują prawdziwe dekodowanie i walidację aplikacji; udowadniają zarówno porażkę całkowicie
  nieużytecznej odpowiedzi, jak i zachowanie prawidłowych kart w odpowiedzi mieszanej.
- Nieudane generowanie zachowuje tekst, wcześniejsze edycje i wybór kart, a użytkownik może ponowić operację.
- Mały zestaw otrzymuje komunikat opisujący liczbę propozycji bez deklarowania poprawności lub bogactwa źródła.
- Trzy zatwierdzone przez użytkownika materiały, wzorce faktów i procedura wspierają powtarzalną ocenę merytoryczną;
  jeden zatwierdzony materiał przechodzi rzeczywiste generowanie i udokumentowaną ocenę człowieka.
- Cookbook dokumentuje faktyczne miejsca, wzorce i komendy; nie przypisuje testom szerszej ochrony niż wykazana.

### Key Discoveries

- `src/lib/openrouter.ts:98`: odpowiedź ma kopertę `choices[0].message.content`; content jest tekstem JSON.
- `src/lib/flashcards.ts:217`: parser zachowuje użytecznych kandydatów; nie odrzuca całego mieszanego zestawu.
- `src/pages/api/flashcards/generate.ts:44`: od jednej do czterech kart to sukces z `sparse: true`.
- `src/components/flashcards/FlashcardWorkspace.tsx:70`: stan propozycji jest zastępowany dopiero po sukcesie.
- `src/components/flashcards/ProposalList.tsx:38`: obecne wyjaśnienie małego zestawu nie wynika z walidacji.
- `astro.config.mjs:19`: konfiguracja aplikacji uruchamia adapter Cloudflare; testy nie potrzebują jej importować.
- `tsconfig.json:3` i `eslint.config.js:15`: pliki TypeScript testów mogą pozostać w istniejącym projekcie
  z kontrolą typów; globalne osłabianie lintowania nie jest potrzebne.
- `README.md:52`: zapis o nieutrwalaniu treści wymaga precyzyjnego wyjątku dla zatwierdzonych materiałów syntetycznych.

## What We're NOT Doing

- Testów bazy, trwałości zapisu, RLS, cookies, harmonogramu powtórek i pełnej podróży przeglądarkowej — to kolejne etapy.
- Konfiguracji CI, hooków, infrastruktury, nowych workflow GitHub Actions, deploymentu ani migracji bazy.
- Testowania ustawień dostawcy, jego dostępności, SDK, limitów lub wnętrza modelu.
- Pokrycia procentowego, szerokich snapshotów, testów konfiguracji runnera ani testów odtwarzających implementację.
- Nowej walidacji semantycznej w runtime, automatycznego sędziego AI, strojenia promptu lub zmiany modelu.
- Wielokrotnych przebiegów, porównania modeli ani statystycznej oceny jakości poza jedną próbą wymaganą dla ryzyka #2.
- Utrwalania prywatnych tekstów użytkowników, odpowiedzi produkcyjnych, sekretów lub surowych kopert dostawcy.

## Implementation Approach

Najtańszy sygnał dla ryzyka #1 zapewnią dwa zestawy integracyjne. Pierwszy wywołuje rzeczywisty handler POST,
adapter i parser, zastępując wyłącznie fetch do OpenRouter. Drugi montuje prawdziwy komponent workspace wraz
z dziećmi i podaje kontrolowane odpowiedzi endpointu. Pierwszy dowodzi kontraktu serwera, drugi widocznej reakcji UI;
nie nazywamy ich testem przeglądarkowym ani dowodem izolacji kont.

Runner: Vitest 4.1.6, środowisko Node dla API i jsdom 27.4.0 dla komponentu. Komponent korzysta z React Testing Library
16.3.0, wymaganej linii `@testing-library/dom ^10` oraz `@testing-library/user-event ^14`.
Zapisz dokładnie rozwiązane wersje zależności w lockfile. Użyj standardowych asercji Vitest i właściwości DOM;
dodatkowy pakiet matcherów nie jest potrzebny w tym zakresie.

Te wersje Vitest/jsdom oraz peer dependencies React Testing Library zweryfikowano w dokumentacji i manifestach
wersjonowanych 2026-09-08; wspierają Node 22.18 i React 19, a Vitest wspiera Vite 7.
Nie wykonano jeszcze instalacji. Kontrole fazy 1/2 muszą potwierdzić zgodność całego rozwiązanego drzewa zależności.
Zachowaj obecny Vite override i wersję Node; nie rozwiązuj ewentualnej niezgodności przez nieplanowaną migrację stacku.

Dla ryzyka #2 przygotujemy trzy teksty i jawne wzorce, które użytkownik zatwierdzi, a następnie wykonamy jeden
rzeczywisty przebieg dla wybranej zatwierdzonej próbki. Wierność ma wynik pass/fail, a użyteczność pozostaje opisowa.
Błąd merytoryczny oblewa kartę i zestaw oraz trafia do osobnego zadania; jest ważnym wynikiem oceny i nie uruchamia
automatycznego strojenia modelu.

## Critical Implementation Details

### Timing & lifecycle

Alias `astro:env/server` musi rozwiązywać się przed zaimportowaniem endpointu lub adaptera. Moduł testowy dostarcza
wyłącznie fikcyjne wartości oraz wyłączony `DEV_AI_FAILURE_MODE`; skróty deweloperskie omijają dekodowanie i nie mogą
zastępować odpowiedzi dostawcy w tych testach.

### State sequencing

Nie czyść propozycji przed zakończeniem nowego generowania. Testy muszą zaobserwować zachowanie edycji i odrzuceń
po błędzie, a ich zastąpienie dopiero po późniejszym sukcesie. Testy nie powinny zależeć od losowej wartości UUID.

### Timing of human review

Zatwierdzenie materiałów wzorcowych poprzedza rzeczywisty przebieg wymagany do odbioru fazy 3. Nie wolno wpisywać
fikcyjnych wyników PASS ani oznaczać materiału lub oceny jako zatwierdzonych bez odpowiedzi użytkownika.

## Phase 1: Testy kontraktu generowania przez API

### Overview

Dodaj najmniejszy działający runner wraz z testami produktu przekraczającymi granicę endpoint–adapter–parser.
Nie kończ tej fazy na pustej konfiguracji lub pojedynczym teście helpera.

### Changes Required

#### 1. Runner i komenda

**Files**: `package.json`, `package-lock.json`, `vitest.config.ts`, `README.md`.

**Intent**: Umożliwić uruchamianie testów TypeScript bez startowania aplikacji i usług.

**Contract**: Dodaj deweloperską zależność Vitest 4.1.6 oraz `test: vitest run` i `test:watch: vitest`.
Konfiguracja samodzielna importuje narzędzia Vitest, zachowuje alias `@/`, transformację JSX automatic i środowisko
Node jako domyślne. Odkrywa wyłącznie `tests/**/*.test.{ts,tsx}`. API testowe są importowane jawnie.
Udokumentuj komendy przed dodaniem testów; zachowaj `deploy:check` bez zmian.

#### 2. Kontrolowana granica środowiska

**Files**: `tests/support/astro-env.ts`, `vitest.config.ts`.

**Intent**: Pozwolić testom importować rzeczywistą ścieżkę serwerową bez sekretów i adaptera platformowego.

**Contract**: Dokładny alias `astro:env/server` wskazuje moduł testowy eksportujący fikcyjne
`OPENROUTER_API_KEY`, `OPENROUTER_MODEL` oraz `DEV_AI_FAILURE_MODE = undefined`.
Nie wczytuj `.env` ani `.dev.vars`. Alias obowiązuje wyłącznie w runnerze, a nie w buildzie aplikacji.
Żaden stub nie zastępuje `generateFlashcards`, `parseProposals` ani handlera POST.

#### 3. Testy kontraktu produktu

**File**: `tests/integration/flashcards/generate.test.ts`.

**Intent**: Chronić publiczne wyniki generowania przy prawdziwej walidacji i dekodowaniu.

**Contract**: Twórz prawdziwy Request z pasującym Origin, nagłówkiem JSON i kontekstem zalogowanego użytkownika.
Minimalny kontekst Astro może używać pojedynczej opisanej asercji typu na granicy helpera; nie używaj rozlanego
`any` ani pełnego fikcyjnego runtime. Fetch zwraca kontrolowany Response wyłącznie dla oczekiwanego adresu
OpenRouter. Nieoczekiwane wywołanie powoduje porażkę testu, nigdy wyjście do sieci. Przywracaj stuby po każdym teście.

Wyniki oczekiwane pochodzą z ręcznie określonych przykładów i zaakceptowanych wymagań:

| Przypadek                                                                                 | Oczekiwany wynik                                                                   |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Niepoprawny zewnętrzny JSON                                                               | 502, `malformed_output`, brak propozycji                                           |
| Pusta koperta choices lub content innego typu                                             | 502, `malformed_output`                                                            |
| Tekst content niebędący JSON                                                              | 502, `malformed_output`                                                            |
| Poprawny JSON o złej strukturze, np. null albo proposals niebędące tablicą                | 422, `no_usable_proposals`                                                         |
| Pusta tablica albo sami nieużyteczni kandydaci                                            | 422, `no_usable_proposals`                                                         |
| Mieszanka null, brakujących/pustych/poprzekraczanych pól i poprawnych kart                | 200, dokładnie oczekiwani poprawni kandydaci w kolejności wejścia                  |
| Duplikat poprawnego pytania różniący się wielkością liter, interpunkcją lub formą Unicode | Pozostaje pierwsza użyteczna karta; nie kopiuj algorytmu normalizacji do oczekiwań |
| Niepoprawna pierwsza karta i późniejsza poprawna karta o tym samym pytaniu                | Poprawna karta pozostaje; niepoprawna nie rezerwuje tożsamości pytania             |
| 1, 4 i 5 kart po filtracji                                                                | Odpowiednio `sparse: true`, `true`, `false`; każda odpowiedź to sukces             |
| 16 poprawnych unikalnych kart, w tym duplikat przy granicy jako osobny wariant            | Pierwszych 15 użytecznych unikalnych kart; duplikat nie zużywa miejsca             |
| Pytanie 200/201 i odpowiedź 500/501 znaków po trimowaniu                                  | Granica włącznie akceptowana; kandydat ponad granicą odrzucony                     |
| Źródło 999, 1 000, 10 000 i 10 001 znaków po trimowaniu                                   | 422, sukces, sukces, 422; odrzucone źródło nie wywołuje dostawcy                   |
| Fetch odrzucony jako TimeoutError lub AbortError                                          | 504, `provider_timeout`                                                            |
| Inny błąd transportu albo odpowiedź dostawcy 500                                          | 502, `provider_failure`                                                            |

Przykłady można łączyć i parametryzować; tabela określa zachowania, a nie minimalną liczbę funkcji testowych.
Użyj literalnych granic 200/500/1 000/10 000, nie wartości oczekiwanych obliczonych z produkcyjnych stałych.
Helper może budować kopertę JSON, ale nie wybierać poprawnych kart ani generować oczekiwanego rezultatu przez parser.
Sprawdź również, że trimowane źródło trafia do wiadomości użytkownika; nie utrwalaj snapshotu całego promptu.

Timeout symuluj odrzuconą obietnicą, nie rzeczywistym oczekiwaniem 17 sekund.
Stubuj wywołania logowania tylko w celu czytelności wyników, z przywróceniem stanu; nie buduj osobnego testu logów.

### Success Criteria

#### Automated Verification

- Testy API przechodzą bez usług zewnętrznych: `npm run test -- tests/integration/flashcards/generate.test.ts`.
- Macierz API obejmuje błędne koperty i treść, brak użytecznych kart, mieszane wyniki, granice wejścia i kart, duplikaty, limit zestawu oraz błędy dostawcy.
- Synchronizacja, lint, typy i build przechodzą: `npx astro sync`, `npm run lint`, `npx astro check`, `npm run build`.

**Implementation Note**: Ta faza ma wyłącznie kryteria automatyczne. Nie wymaga dostawcy AI, bazy ani ręcznego
uruchomienia generowania. Kontynuacja kolejnej fazy odbywa się według wybranego polecenia implementacji.

---

## Phase 2: Testy odzyskiwania po błędach i neutralny komunikat

### Overview

Sprawdź odzyskiwanie po błędzie na poziomie rzeczywistego komponentu React. Popraw jedyny zatwierdzony element UI:
wyjaśnienie małego zestawu.

### Changes Required

#### 1. Środowisko komponentu

**Files**: `package.json`, `package-lock.json`, `tests/setup-dom.ts`,
`tests/integration/flashcards/FlashcardWorkspace.test.tsx`.

**Intent**: Testować działania użytkownika i widoczny stan bez przeglądarki i renderowania Astro.

**Contract**: Dodaj jsdom 27.4.0, React Testing Library 16.3.0, DOM Testing Library ^10 oraz user-event ^14.
Środowisko jsdom wybierz dla tego pliku testowego; Node pozostaje domyślny.
Setup jest importowany wyłącznie przez test komponentu. Rejestruje jawny cleanup React Testing Library oraz
sprzątanie stubów. Korzystaj z rzeczywistych komponentów potomnych i zapytań po rolach/etykietach.
Nie dodawaj `global-jsdom`, przeglądarkowego providera, osobnego tsconfig ani szerokiego wyłączenia lintowania.

#### 2. Zachowanie workspace

**File**: `tests/integration/flashcards/FlashcardWorkspace.test.tsx`.

**Intent**: Udowodnić, że po błędzie użytkownik zachowuje pracę i może uzyskać użyteczne propozycje.

**Contract**: Zastąp fetch do `/api/flashcards/generate` zgodnymi z kontraktem odpowiedziami, których gwarancje
sprawdza faza 1. Poniższe scenariusze korzystają z prawdziwego stanu i walidacji UI:

- Za krótkie źródło wyświetla błąd i nie wysyła żądania.
- Najpierw zakończ jedno udane generowanie, aby zainstalować propozycje. Następnie uruchom drugie generowanie
  z kontrolowaną oczekującą odpowiedzią i sprawdź blokadę źródła, generowania, edycji, wyboru kart i zapisu;
  po zakończeniu blokady znikają. Nie używaj opóźnień ściennych.
- Reprezentatywne błędy `provider_timeout`, `provider_failure`, `malformed_output` i
  `no_usable_proposals` pokazują alert oraz pozostawiają źródło i możliwość ponowienia.
- Odrzucony fetch oraz nieczytelny JSON odpowiedzi endpointu pokazują ogólny błąd i odblokowują retry.
- Porażka, a następnie sukces usuwa alert i pokazuje edytowalne, domyślnie zaakceptowane karty.
- Użytkownik edytuje propozycję i odrzuca inną, potwierdza nowe generowanie, otrzymuje błąd:
  tekst, edycja i odrzucenie pozostają. Dopiero późniejszy sukces zastępuje zestaw.
- Anulowanie potwierdzenia nie wysyła nowego żądania ani nie zmienia propozycji.
- Odrzucenie wszystkich kart blokuje zapis; przywrócenie poprawnej karty ponownie go udostępnia.
  Nie wywołuj faktycznego zapisu ani nie traktuj tego jako dowodu trwałości.

Kontroluj `window.confirm` jawnie. UUID traktuj jako nieprzezroczyste; sprawdzaj wartości i dostępność pól,
nie konkretne identyfikatory. user-event służy do interakcji; wklejenie długiego źródła nie wymaga tysięcy
symulowanych uderzeń klawiszy. Oczekuj na widoczne zmiany bez ręcznych sleepów.

Nie wstrzykuj fałszywego sukcesu z uszkodzonymi kartami jako rzekomego błędu ścieżki dostawcy:
runtime serwera blokuje ten przypadek. Nie dodawaj nowych zabezpieczeń klienta bez wykazanego naruszenia kontraktu.

#### 3. Neutralny komunikat

**File**: `src/components/flashcards/ProposalList.tsx`.

**Intent**: Usunąć nieudowodnione wyjaśnienie liczby zwróconych kart.

**Contract**: Zachowaj istniejący warunek `sparse` i rolę statusu. Tekst w anglojęzycznym interfejsie:
“Fewer than five proposals were returned. Review them against your source.”
Test workspace obejmuje obecność komunikatu dla małego zestawu i brak dla normalnego zestawu.
Nie zmieniaj limitów, promptu ani klasyfikacji błędów.

### Success Criteria

#### Automated Verification

- Testy komponentu przechodzą: `npm run test -- tests/integration/flashcards/FlashcardWorkspace.test.tsx`.
- Testy dowodzą zachowania tekstu, edycji i odrzuceń po błędzie, poprawnego ponowienia, anulowania zastąpienia oraz blokady wszystkich istniejących kontrolek podczas drugiego, oczekującego żądania po udanym generowaniu.
- Mały zestaw pokazuje neutralny komunikat, a normalny zestaw go nie pokazuje; interfejs nie przypisuje liczbie kart przyczyny semantycznej.
- Cały zestaw i istniejące kontrole przechodzą: `npm run test`, `npx astro sync`, `npm run lint`, `npx astro check`, `npm run build`.

**Implementation Note**: Nie wprowadzamy osobnego ręcznego przebiegu generowania ani infrastruktury screenshotów.
Zmiana dotyczy tekstu w istniejącym kontenerze; zachowanie weryfikują testy komponentu. Jeśli później powstanie PR,
stosuj wymagania repo dotyczące dokumentowania widocznych zmian.

---

## Phase 3: Materiały wzorcowe, procedura oceny i cookbook

### Overview

Przygotuj procedurę niezależnej oceny, zatwierdź wzorce, a następnie wykonaj i zachowaj jeden rzeczywisty przebieg
generowania dla wybranej zatwierdzonej próbki oraz jego pełną ocenę człowieka.

### Changes Required

#### 1. Materiały i niezależne oczekiwania

**Files**:
`tests/quality/ai-generation/sources/factual-en.txt`,
`tests/quality/ai-generation/sources/conditions-pl.txt`,
`tests/quality/ai-generation/sources/sparse-pl.txt`,
`tests/quality/ai-generation/reference-facts.md`.

**Intent**: Dostarczyć mały, kontrolowany zbiór materiałów z niezależnym wzorcem odpowiedzi.

**Contract**: Każdy tekst to 1 000–10 000 znaków po trimowaniu, wyłącznie materiał źródłowy.
Użyj fikcyjnego systemu programistycznego, którego zasady tekst w pełni definiuje; unikaj zależności od
zewnętrznych dokumentacji zmieniających się w czasie. Zestaw obejmuje zwykłe fakty, warunki/negację/wyjątki
oraz małą liczbę pojęć opisaną bez dodawania kolejnych faktów dla wypełnienia limitu.

Wzorzec zawiera identyfikator i rewizję próbki, język, fakty z odwołaniami do akapitów, akceptowalne parafrazy,
zabronione odwrócenia znaczenia oraz opis kluczowych pojęć. Oczekiwania opracuj z tekstu przed generowaniem;
nie korzystaj z odpowiedzi modelu jako źródła prawdy. Początkowy status to szkic.
Użytkownik musi skorygować i zatwierdzić źródła, fakty i kryteria; dopiero wtedy zapisz datę i potwierdzenie.
Przy zmianie tekstu lub wzorca po zatwierdzeniu wymagana jest ponowna weryfikacja zmienionego materiału.

#### 2. Rubryka i zapis oceny

**Files**: `tests/quality/ai-generation/rubric.md`,
`tests/quality/ai-generation/review-template.md`.

**Intent**: Umożliwić ocenę faktycznej zgodności bez mylenia jej z formatem, pokryciem treści lub oceną modelu przez siebie.

**Contract**: Każda karta otrzymuje ocenę podparcia w źródle, zgodności odpowiedzi, zachowania warunków i negacji
oraz rozstrzygalności pytania. Sprzeczność, brak podparcia lub brak możliwości odpowiedzi na podstawie źródła
oznacza fail dla karty i całego zestawu. Sporna ocena pozostaje nierozstrzygnięta do decyzji człowieka, nigdy pass.

Osobno zapisuj samodzielność pytania, jeden koncept, pokrywanie się kart, język źródła, pominięcia,
potrzebne edycje i decyzję accept/edit/reject z powodem. Nie ma sztywnego procentowego progu użyteczności,
wymogu pełnego pokrycia ani dokładnej liczby/treści pytań. PRD-owe 75% nie jest progiem testowym.

Szablon wymaga rewizji próbki i aplikacji, daty, modelu, osoby oceniającej, liczby otrzymanych kart,
ich nieedytowanej treści z zatwierdzonego syntetycznego przebiegu, dowodów z tekstu, wyników per karta i podsumowania.
Zachowaj wypełnioną kopię pod `tests/quality/ai-generation/reviews/YYYY-MM-DD-<sample-id>.md`; nie twórz
fałszywych rezultatów ani nie zastępuj niekorzystnego wyniku kolejnym przebiegiem.

Błąd merytoryczny ma zostać udokumentowany i otrzymać odnośnik do osobnego lokalnego zadania zmiany
pod `context/changes/`. Nie twórz zdalnego zgłoszenia ani automatycznej pętli poprawek promptu/modelu.
Wykrycie fail spełnia wymaganie wykonania oceny, ale nie może zostać przemianowane na pass ani uznane za ochronę
przed błędem merytorycznym.

#### 3. Instrukcja wykonania i późniejszego użycia

**Files**: `tests/quality/ai-generation/README.md`, `README.md`.

**Intent**: Wykonać pierwszy przebieg i sprawić, aby kolejne ręczne oceny były możliwe bez doprecyzowywania zasad
i bez nowych narzędzi.

**Contract**: Udokumentuj następującą procedurę:

1. Potwierdź zatwierdzenie rewizji źródeł i wzorców.
2. W istniejącym skonfigurowanym środowisku uruchom `npm run dev`, zaloguj się i otwórz `/dashboard`.
3. Wklej treść wybranej próbki, wygeneruj jeden zestaw i zachowaj wynik przed edycją; nie zapisuj kart do kolekcji.
4. Oceń wszystkie karty według rubryki i wypełnij kopię szablonu pod
   `tests/quality/ai-generation/reviews/YYYY-MM-DD-<sample-id>.md`.
5. Odnotuj porażkę dostawcy jako brak wyniku oceny, a nie pass/fail merytoryczny. Nie powtarzaj generowania
   do uzyskania lepszego wyniku i nie pomijaj niekorzystnego zestawu; kolejne uruchomienie to osobny zapis.
6. Dla błędów merytorycznych zachowaj dowód i otwórz osobne zadanie. Omów użyteczność bez dopisywania progu liczbowego.

Ta procedura jest selektywna: jeden przebieg jest wymagany przez ten rollout, a kolejne są zalecane przy zmianie promptu,
modelu lub zgłoszeniu problemu z treścią. Nie jest uruchamiana przez `npm run test` ani per edit.
Warunkiem uruchomienia jest istniejąca konfiguracja i dostęp użytkownika, nie budowa nowej infrastruktury.
Porażka dostawcy oznacza brak wyniku i nie spełnia kryterium odbioru; nie powtarzaj przebiegu bez odnotowania porażki
i jawnej decyzji użytkownika o ponowieniu.

README główny ma rozróżniać prywatny materiał od zatwierdzonych syntetycznych próbek i ich świadomie zapisanych
wyników oceny. Zakaz ujawniania sekretów, prywatnej treści i surowych payloadów dostawcy pozostaje.
Nie zmieniaj logowania produkcyjnego.

AI może być rozważone dopiero po porównaniu z ludzkimi etykietami i wykazaniu dodatkowego sygnału; teraz nie instalujemy
narzędzia ani nie wybieramy sędziego. **When NOT to use**: walidacja formatu, tania ocena ludzka, brak kalibracji.
Odnotuj ten wniosek z datą sprawdzenia; nie przedstawiaj przyszłej możliwości jako dostarczonej ochrony.

#### 4. Cookbook i przekazanie

**File**: `context/foundation/test-plan.md`, sekcje §6.1 i §6.2.

**Intent**: Pozostawić jedno kanoniczne miejsce z instrukcją dodawania testów i wykonywania ocen.

**Contract**: §6.1 wskazuje test API i komponentu, naming `*.test.ts` / `*.test.tsx`, granice stubowania
i dokładne komendy pełnego oraz selektywnego uruchomienia. §6.2 wskazuje trzy źródła, wzorce, rubrykę, szablon
i instrukcję, wraz z procedurą `npm run dev` → dashboard → ręczna ocena.
Zapisz wersje użytych narzędzi i datę weryfikacji tam, gdzie opisujesz gotowy wzorzec.

Jawnie odnotuj zatwierdzenie materiałów oraz ścieżkę do pierwszego zapisu oceny wraz z wynikiem wierności.
Nie przepisuj zamrożonej strategii §1–§5 ani wyłączeń §7.
Status rolloutowy jest wyprowadzany przez orchestrator z artefaktów i postępu; nie oznaczaj ochrony jako ukończonej
przed spełnieniem kryteriów tej zmiany.

### Success Criteria

#### Automated Verification

- Trzy pliki źródłowe, wzorce faktów, rubryka, szablon oceny i instrukcja istnieją; każdy tekst mieści się w zakresie 1 000–10 000 znaków po trimowaniu.
- Dokumentacja ma poprawny format: `npx prettier --check tests/quality/ai-generation/*.md README.md context/foundation/test-plan.md`.
- Końcowe testy i kontrole przechodzą: `npm run test`, `npx astro sync`, `npm run lint`, `npx astro check`, `npm run build`.

#### Manual Verification

- Użytkownik sprawdził, poprawił i zatwierdził trzy teksty, oczekiwane fakty oraz kryteria; wzorce zawierają datę i potwierdzenie tej weryfikacji.
- Użytkownik wykonał jeden przebieg dla wybranej zatwierdzonej próbki, zachował nieedytowane karty i ocenił każdą
  według rubryki; zapis zawiera dowody, wynik wierności zestawu oraz opisową ocenę użyteczności.
- Użytkownik potwierdził, że instrukcja rozdziela wynik wierności od użyteczności i pozwala powtórzyć ocenę bez dopowiadania zasad.
- Cookbook §6.1 i §6.2 wskazuje działające komendy, zweryfikowane materiały i zapis pierwszej rzeczywistej oceny.

**Implementation Note**: Przygotuj komplet materiałów i wykonaj kontrole automatyczne przed poproszeniem
o zatwierdzenie oraz rzeczywistą ocenę człowieka. Nie zaznaczaj kryteriów Manual bez rzeczywistej odpowiedzi użytkownika.
Jeżeli dostawca nie zwróci zestawu, udokumentuj brak wyniku i pozostaw kryterium przebiegu nieukończone.

---

## Testing Strategy

### Unit Tests

Nie dodajemy osobnego zestawu testów każdego helpera. Przypadki parsera otrzymują sygnał przez prawdziwy endpoint;
unikamy dublowania tych samych oczekiwań na kilku poziomach.

### Integration Tests

- API: rzeczywisty handler, adapter i parser; stub transportu dostawcy, fikcyjna konfiguracja.
- UI: rzeczywisty workspace i dzieci; stub odpowiedzi endpointu, kontrolowane potwierdzenie i oczekiwanie.
- Stuby są lokalne dla testów i sprzątane. Żaden test nie wymaga internetu, konta ani bazy.
- Awaria deterministycznej asercji blokuje odpowiednią fazę. Zweryfikuj kontrakt i napraw przyczynę w zakresie
  zmiany; nie zmieniaj oczekiwań tylko po to, aby test przeszedł. Szersze zmiany zachowania wymagają korekty planu.
- Testy nie dowodzą poprawności cookies, wdrożenia Workers, RLS, zapisu kart ani semantycznej jakości modelu.

### Manual Testing Steps

W tym rolloutcie człowiek weryfikuje kompletność i poprawność materiałów oraz jednoznaczność rubryki.
Nie wykonuje obowiązkowych wywołań modelu. Późniejszy przebieg opisany w fazie 3 wymaga osobnego zapisania
rzeczywistych wyników i nie może zostać zastąpiony zaznaczeniem checkboxa z przygotowania procedury.

## Performance Considerations

Deterministyczne testy nie czekają na rzeczywisty timeout i nie wpisują długich źródeł znak po znaku.
Nie dodajemy benchmarku ani gwarancji czasu działania dostawcy. Zależności testowe są deweloperskie;
konfiguracja testowa nie trafia do runtime aplikacji.

## Migration Notes

Nie ma migracji danych, sekretów ani ustawień usług. Zmiany produktu ograniczają się do komunikatu.
Wycofanie dotyczy plików testów/dokumentacji, zależności i tekstu; nie wymaga operacji na bazie.
Nie commituj ani nie wdrażaj artefaktów w ramach samego planowania.

Roadmap odczytano: brak elementu z dokładnym Change ID `testing-ai-generation-validity`.
Nie zmieniamy statusu istniejącego S-02 ani innych etapów produktu.

## References

- [Research](research.md), [uzgodnione decyzje](change.md), [kontrakt jakości](../../foundation/test-plan.md).
- `src/pages/api/flashcards/generate.ts:11`, `src/lib/openrouter.ts:98`, `src/lib/flashcards.ts:217`.
- `src/components/flashcards/FlashcardWorkspace.tsx:70`, `src/components/flashcards/ProposalList.tsx:38`.
- `context/changes/ai-flashcard-review/plan.md:128` — niezależnie zapisane granice i reguły kart.
- [Vitest 4.1.6: manifest](https://github.com/vitest-dev/vitest/blob/v4.1.6/packages/vitest/package.json)
  i [mockowanie modułów wirtualnych](https://github.com/vitest-dev/vitest/blob/v4.1.6/docs/guide/mocking/modules.md).
- [jsdom 27.4.0: manifest](https://github.com/jsdom/jsdom/blob/v27.4.0/package.json).
- [React Testing Library 16.3.0: manifest](https://github.com/testing-library/react-testing-library/blob/v16.3.0/package.json)
  i [instrukcja](https://testing-library.com/docs/react-testing-library/intro/).
- [Astro 6: ograniczenia renderowania w testach](https://docs.astro.build/en/guides/upgrade-to/v6/).
- Dokumentację pobrano przez Context7, a wymagania wersji sprawdzono w manifestach upstream; checked: 2026-09-08.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `— <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Testy kontraktu generowania przez API

#### Automated

- [x] 1.1 Testy API przechodzą bez usług zewnętrznych: `npm run test -- tests/integration/flashcards/generate.test.ts`. — 2734e42
- [x] 1.2 Macierz API obejmuje błędne koperty i treść, brak użytecznych kart, mieszane wyniki, granice wejścia i kart, duplikaty, limit zestawu oraz błędy dostawcy. — 2734e42
- [x] 1.3 Synchronizacja, lint, typy i build przechodzą: `npx astro sync`, `npm run lint`, `npx astro check`, `npm run build`. — 2734e42

### Phase 2: Testy odzyskiwania po błędach i neutralny komunikat

#### Automated

- [x] 2.1 Testy komponentu przechodzą: `npm run test -- tests/integration/flashcards/FlashcardWorkspace.test.tsx`. — a452a28
- [x] 2.2 Testy dowodzą zachowania tekstu, edycji i odrzuceń po błędzie, poprawnego ponowienia, anulowania zastąpienia oraz blokady wszystkich istniejących kontrolek podczas drugiego, oczekującego żądania po udanym generowaniu. — a452a28
- [x] 2.3 Mały zestaw pokazuje neutralny komunikat, a normalny zestaw go nie pokazuje; interfejs nie przypisuje liczbie kart przyczyny semantycznej. — a452a28
- [x] 2.4 Cały zestaw i istniejące kontrole przechodzą: `npm run test`, `npx astro sync`, `npm run lint`, `npx astro check`, `npm run build`. — a452a28

### Phase 3: Materiały wzorcowe, procedura oceny i cookbook

#### Automated

- [x] 3.1 Trzy pliki źródłowe, wzorce faktów, rubryka, szablon oceny i instrukcja istnieją; każdy tekst mieści się w zakresie 1 000–10 000 znaków po trimowaniu. — 8773a09
- [x] 3.2 Dokumentacja ma poprawny format: `npx prettier --check tests/quality/ai-generation/*.md README.md context/foundation/test-plan.md`. — 8773a09
- [x] 3.3 Końcowe testy i kontrole przechodzą: `npm run test`, `npx astro sync`, `npm run lint`, `npx astro check`, `npm run build`. — 8773a09

#### Manual

- [x] 3.4 Użytkownik sprawdził, poprawił i zatwierdził trzy teksty, oczekiwane fakty oraz kryteria; wzorce zawierają datę i potwierdzenie tej weryfikacji. — 8773a09
- [x] 3.5 Użytkownik wykonał jeden przebieg dla wybranej zatwierdzonej próbki, zachował nieedytowane karty i ocenił każdą według rubryki; zapis zawiera dowody, wynik wierności zestawu oraz opisową ocenę użyteczności. — 8773a09
- [x] 3.6 Użytkownik potwierdził, że instrukcja rozdziela wynik wierności od użyteczności i pozwala powtórzyć ocenę bez dopowiadania zasad. — 8773a09
- [x] 3.7 Cookbook §6.1 i §6.2 wskazuje działające komendy, zweryfikowane materiały i zapis pierwszej rzeczywistej oceny. — 8773a09
