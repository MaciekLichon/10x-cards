---
project: "10xCards"
version: 1
status: draft
created: 2026-08-03
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: null
  data_volume: null
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Programista rozwijający kompetencje na podstawie artykułów, dokumentacji i kursów chce utrwalać wiedzę metodą spaced repetition. Ręczne opracowywanie wysokiej jakości fiszek jest jednak na tyle czasochłonne, że osłabia motywację do ich tworzenia i regularnych powtórek.

Dostępnych jest niewiele narzędzi wykorzystujących AI bezpośrednio do tego procesu.

## User & Persona

Główną personą jest programista, który podczas rozwoju zawodowego przyswaja wiedzę z artykułów, dokumentacji i kursów. Po zapoznaniu się z materiałem chce szybko zamienić najważniejsze informacje w fiszki, zamiast tworzyć je ręcznie.

## Success Criteria

### Primary

- Użytkownik przechodzi pełny przepływ: logowanie → wklejenie tekstu → wygenerowanie propozycji → ocena, edycja lub akceptacja → sesja powtórkowa.
- Co najmniej 75% fiszek wygenerowanych przez AI zostaje zaakceptowanych.
- Co najmniej 75% fiszek użytkownicy tworzą z wykorzystaniem AI.

### Secondary

- Użytkownicy wracają do aplikacji na kolejne sesje powtórkowe.

### Guardrails

- Sesja powtórkowa nigdy nie traci zapisanego postępu użytkownika.
- Sesja nigdy nie pokazuje fiszki innego użytkownika ani karty niezgodnej z bieżącym harmonogramem powtórek.

## User Stories

### US-01: Generowanie fiszek z tekstu źródłowego

- **Given** zalogowany użytkownik znajduje się na ekranie głównym
- **When** wkleja tekst źródłowy i uruchamia generowanie
- **Then** widzi zestaw wygenerowanych fiszek, które może zaakceptować, edytować albo odrzucić
- **And** zaakceptowane fiszki pojawiają się w jego kolekcji i są gotowe do sesji spaced repetition

#### Acceptance Criteria

- Nie można rozpocząć generowania bez podania tekstu źródłowego.
- Błąd generowania jest obsługiwany bez przerwania działania aplikacji, a użytkownik otrzymuje informację o błędzie.
- Użytkownik może odrzucić wszystkie wygenerowane propozycje; nie powoduje to błędu ani zapisania fiszek.
- Tylko zaakceptowane fiszki trafiają do kolekcji użytkownika.

## Functional Requirements

### Konto

- FR-001: Użytkownik może utworzyć konto za pomocą adresu e-mail i hasła. Priority: must-have
  > Socrates: Rozważono, czy rejestracja nie opóźnia poznania wartości produktu lub jest zbędna dla małej grupy testowej. Rozstrzygnięcie: wymaganie pozostaje bez zmian.
- FR-002: Użytkownik może zalogować się do swojego konta. Priority: must-have
  > Socrates: Rozważono, czy obowiązkowe logowanie nie zwiększa tarcia i czy anonimowa sesja wystarczyłaby do demonstracji. Rozstrzygnięcie: wymaganie pozostaje bez zmian.

### Generowanie fiszek

- FR-003: Użytkownik może wkleić tekst źródłowy, a przy polu widzi krótką instrukcję opisującą materiał sprzyjający dobrym wynikom. Priority: must-have
  > Socrates: Kontrargument przyjęty: pole bez wskazówek może prowadzić do materiału słabej jakości. Rozstrzygnięcie: przy polu pojawi się krótka instrukcja dotycząca odpowiedniego tekstu źródłowego.
- FR-004: Użytkownik może wygenerować propozycje fiszek na podstawie wklejonego tekstu. Priority: must-have
  > Socrates: Rozważono ryzyko błędnych fiszek oraz kosztu i czasu generowania całego zestawu. Rozstrzygnięcie: wymaganie pozostaje bez zmian.
- FR-005: Użytkownik może zaakceptować albo odrzucić każdą wygenerowaną propozycję. Priority: must-have
  > Socrates: Rozważono, czy selekcja każdej fiszki nie staje się równie męcząca jak ręczne tworzenie i nie wydłuża drogi do nauki. Rozstrzygnięcie: wymaganie pozostaje bez zmian.
- FR-006: Użytkownik może edytować wygenerowaną propozycję przed jej zaakceptowaniem. Priority: must-have
  > Socrates: Rozważono, czy edycja przed akceptacją nie komplikuje interfejsu i nie odtwarza problemu ręcznego tworzenia. Rozstrzygnięcie: wymaganie pozostaje bez zmian.

### Zarządzanie kolekcją

- FR-007: Użytkownik może ręcznie utworzyć fiszkę. Priority: must-have
  > Socrates: Rozważono, czy ręczne tworzenie odciąga od głównej hipotezy AI i utrudnia ocenę jej wykorzystania. Rozstrzygnięcie: wymaganie pozostaje bez zmian.
- FR-008: Użytkownik może przeglądać swoją kolekcję fiszek. Priority: must-have
  > Socrates: Rozważono, czy osobny widok kolekcji jest niezbędny oraz czy duża kolekcja nie wymusi wyszukiwania i filtrowania. Rozstrzygnięcie: wymaganie pozostaje bez zmian.
- FR-009: Użytkownik może edytować istniejącą fiszkę. Priority: must-have
  > Socrates: Rozważono dublowanie edycji propozycji i wpływ zmiany treści na dotychczasowy postęp. Rozstrzygnięcie: wymaganie pozostaje bez zmian.
- FR-010: Użytkownik może usunąć istniejącą fiszkę. Priority: must-have
  > Socrates: Rozważono ryzyko przypadkowej utraty postępu oraz brak konieczności usuwania w głównym przepływie. Rozstrzygnięcie: wymaganie pozostaje bez zmian.

### Nauka

- FR-011: Użytkownik może rozpocząć sesję powtórkową obejmującą fiszki przewidziane do powtórki. Priority: must-have
  > Socrates: Rozważono, czy integracja powtórek nie jest zbyt szeroka dla MVP i czy niejasny wybór kart nie podważy poprawności sesji. Rozstrzygnięcie: wymaganie pozostaje bez zmian.
- FR-012: Użytkownik może ocenić znajomość pokazanej fiszki, a jego postęp zostaje zachowany do następnej sesji. Priority: must-have
  > Socrates: Rozważono złożoność wielostopniowej oceny i ryzyko utraty postępu przy błędzie zapisu. Rozstrzygnięcie: wymaganie pozostaje bez zmian.

## Non-Functional Requirements

- Podczas generowania użytkownik przez cały czas widzi jasną informację o trwającym postępie.
- Dla tekstu mieszczącego się w obsługiwanym limicie typowe generowanie kończy się w ciągu 10–15 sekund; wpływ długości materiału musi być czytelny dla użytkownika.
- Tekst źródłowy nie jest przechowywany po zakończeniu żądania generowania.
- Aplikacja działa w aktualnych wersjach nowoczesnych przeglądarek desktopowych.
- Postęp sesji powtórkowej nie może zostać utracony.
- Użytkownik nigdy nie otrzymuje fiszki należącej do innego konta ani karty niezgodnej z bieżącym harmonogramem.

## Business Logic

Aplikacja decyduje, czego użytkownik powinien się uczyć poprzez ekstrakcję wiedzy z tekstu źródłowego oraz kiedy powinien ją powtarzać poprzez harmonogram spaced repetition.

Jedynym wejściem do ekstrakcji w MVP jest tekst wklejony przez użytkownika. Szczegółowy format wyniku ekstrakcji oraz sposób oceniania odpowiedzi i wyznaczania kolejnego terminu przez gotowy algorytm powtórek pozostają do ustalenia.

## Access Control

Użytkownik zakłada konto i loguje się za pomocą adresu e-mail oraz hasła. W MVP istnieje jedna rola; wszyscy użytkownicy mają takie same uprawnienia funkcjonalne. Każdy zalogowany użytkownik ma dostęp wyłącznie do własnych fiszek. Niezalogowany użytkownik nie może korzystać z funkcji zarządzania ani generowania fiszek.

## Non-Goals

- Brak własnego zaawansowanego algorytmu powtórek — MVP korzysta z gotowego rozwiązania.
- Brak importu PDF, DOCX i innych formatów — wejściem jest wyłącznie wklejony tekst.
- Brak współdzielenia fiszek i kolekcji między użytkownikami.
- Brak integracji z innymi platformami edukacyjnymi.
- Brak aplikacji mobilnej — MVP jest desktopową aplikacją webową.

## Open Questions

1. Jaki dokładnie format i ograniczenia mają mieć wygenerowane fiszki?
2. Jak użytkownik ocenia znajomość fiszki podczas sesji?
3. Jaki gotowy algorytm spaced repetition wyznacza kolejny termin i jak interpretuje ocenę?
4. Jaki maksymalny rozmiar tekstu obejmuje cel generowania w 10–15 sekund?
5. Jak reguły generowania i powtórek powinny zmienić się przy wzroście skali do około 10 000 użytkowników?
6. Jakie są oczekiwane wolumen danych i szczytowa liczba żądań po uruchomieniu?
