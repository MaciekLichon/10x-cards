# AI generation validity — Plan Brief

> Pełny plan: [plan.md](plan.md)
> Badanie: [research.md](research.md)
> Uzgodnienia: [change.md](change.md)

## What & Why

Dodajemy testy wykrywające nieużyteczne odpowiedzi AI i potwierdzające, że użytkownik może odzyskać pracę po błędzie.
Przygotowujemy też materiały i procedurę sprawdzania zgodności fiszek z tekstem źródłowym.
To etap 1 głównego planu testów, wykonany w trzech fazach.

## Starting Point

Aplikacja już filtruje niepoprawne propozycje i zachowuje pracę po błędach, ale nie ma testów aplikacyjnych.
Istniejące testy bazy i powtórek nie chronią generowania; brak również niezależnych materiałów do oceny merytorycznej.

## Desired End State

Jedna komenda lokalna sprawdza kontrakt API i odzyskiwanie po błędach bez usług zewnętrznych.
Mały zestaw fiszek ma neutralny komunikat, a trzy zatwierdzone materiały i rubryka umożliwiają późniejszą ocenę treści.
Pierwsza ocena rzeczywistych wyników pozostaje odroczona — jej wynik nie jest warunkiem ukończenia tej zmiany.

## Key Decisions Made

| Decyzja                  | Wybór                                                          | Uzasadnienie                                                 | Źródło              |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------ | ------------------- |
| Granica testów API       | Prawdziwy endpoint, adapter i parser; stub odpowiedzi dostawcy | Zachowuje rzeczywistą walidację aplikacji                    | Research            |
| Odpowiedź mieszana       | Zachować poprawne karty                                        | Niedoskonały zestaw może nadal być użyteczny                 | Research            |
| Odzyskiwanie po błędzie  | Test prawdziwego komponentu React                              | Sprawdza zachowanie tekstu, edycji i możliwości ponowienia   | Research            |
| Komunikat małego zestawu | Neutralna informacja o liczbie propozycji                      | Liczba kart nie dowodzi ubogiej zawartości źródła            | Plan: Q1            |
| Błąd merytoryczny        | Fail karty i zestawu; osobne zadanie                           | Dostarczenie wykrywania nie wymaga strojenia modelu          | Plan: Q2            |
| Wzorce                   | Codex przygotowuje, użytkownik poprawia i zatwierdza           | Oczekiwania wymagają niezależnej ludzkiej oceny              | Plan: Q3            |
| Pierwsza ocena modelu    | Odroczona                                                      | Ten rollout dostarcza gotową procedurę                       | Plan: Q4            |
| Pominięcia i użyteczność | Opisowo, oddzielnie od wierności                               | Nie narzucamy nieuzgodnionej pełności ani progu procentowego | Plan: Q5            |
| Runner                   | Vitest 4.1.6; jsdom 27.4.0 i React Testing Library             | Pasuje do obecnego Node, Vite i React                        | Plan + dokumentacja |

## Scope

**W zakresie:**

- Minimalny runner, testy API i komponentu oraz poprawka komunikatu.
- Trzy syntetyczne teksty, wzorce faktów, rubryka i szablon późniejszej oceny.
- Komendy i dokumentacja cookbooka §6.1–§6.2.

**Poza zakresem:**

- Baza, własność kart, trwałość zapisu, przeglądarkowe e2e, CI, infrastruktura.
- Wywołania modelu przy odbiorze, automatyczny sędzia AI i strojenie generowania.

## Architecture / Approach

Test API obejmuje endpoint → adapter → parser i zastępuje transport dostawcy.
Test komponentu obejmuje rzeczywisty interfejs z kontrolowanymi odpowiedziami endpointu.
Ocenę merytoryczną wykonuje później człowiek z niezależnym wzorcem; testy struktury nie zastępują tej oceny.

## Phases at a Glance

| Faza            | Rezultat                                                | Główne ryzyko                                            |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| 1. Testy API    | Runner i macierz błędów, filtracji oraz granic          | Testowanie stubów zamiast rzeczywistej walidacji         |
| 2. Odzyskiwanie | Testy zachowania pracy i ponowienia; neutralny tekst UI | Utrata edycji lub pozostawienie zablokowanego interfejsu |
| 3. Ocena treści | Zatwierdzone wzorce, procedura i cookbook               | Przypisanie nieprzeprowadzonej ocenie wyniku PASS        |

**Warunki:** Node 22.18, możliwość instalacji zależności, czas użytkownika na zatwierdzenie wzorców.
**Szacunkowy rozmiar:** około 2–3 sesji implementacyjnych oraz osobny przegląd materiałów.

## Open Risks & Assumptions

- Zgodność manifestów została sprawdzona; instalacja i testy muszą jeszcze potwierdzić całe drzewo zależności.
- Materiały przygotowane przez AI pozostają szkicem do rzeczywistego zatwierdzenia przez użytkownika.
- Jakość merytoryczna modelu pozostanie niezmierzona po ukończeniu tego planu.

## Success Criteria (Summary)

- Testy API i interfejsu przechodzą wraz z istniejącymi kontrolami typów, lintowania i buildu.
- Użytkownik zatwierdził materiały i jasne zasady późniejszej oceny; nie wymagamy przebiegu na żywym modelu.
- Cookbook wskazuje działające komendy i gotowe materiały, jawnie opisując odroczenie pierwszej oceny.
