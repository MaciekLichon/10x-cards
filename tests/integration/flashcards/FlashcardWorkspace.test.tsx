// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import FlashcardWorkspace from "@/components/flashcards/FlashcardWorkspace";
import type { FlashcardProposal } from "@/lib/flashcards";

import "../../setup-dom";

const VALID_SOURCE = `  ${"A focused source sentence with enough context. ".repeat(25)}  `;
const FIRST_PROPOSALS: FlashcardProposal[] = [
  { question: "What is the first rule?", answer: "The first answer." },
  { question: "What is the second rule?", answer: "The second answer." },
];
const REPLACEMENT_PROPOSALS: FlashcardProposal[] = [
  { question: "What replaces the old set?", answer: "A successful retry." },
];
const REVIEWED_PROPOSALS: FlashcardProposal[] = [
  { question: "Which accepted card should persist?", answer: "Only this edited card." },
  { question: "Which rejected card stays visible?", answer: "This rejected card." },
  { question: "Which invalid accepted card stays visible?", answer: "This card becomes invalid." },
];

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function successResponse(proposals = FIRST_PROPOSALS, sparse = proposals.length < 5): Response {
  return Response.json({ proposals, sparse });
}

function errorResponse(code: string, status = 502): Response {
  return Response.json({ error: { code } }, { status });
}

function stubFetch(...results: (Response | Promise<Response> | Error)[]): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>();
  for (const result of results) {
    if (result instanceof Error) {
      fetchMock.mockRejectedValueOnce(result);
    } else {
      fetchMock.mockImplementationOnce(() => Promise.resolve(result));
    }
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderWorkspace() {
  const user = userEvent.setup();
  render(<FlashcardWorkspace aiConfigured />);
  return { user, source: screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Source text" }) };
}

function setSource(source: HTMLTextAreaElement, value = VALID_SOURCE): void {
  fireEvent.change(source, { target: { value } });
}

async function generate(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /generate (flashcards|another set)/i }));
}

async function waitForQuestion(question: string): Promise<HTMLTextAreaElement> {
  return screen.findByDisplayValue<HTMLTextAreaElement>(question);
}

describe("FlashcardWorkspace generation recovery", () => {
  it("rejects a short source without sending a request", async () => {
    const fetchMock = stubFetch();
    const { user, source } = renderWorkspace();

    await user.type(source, "Too short");
    await generate(user);

    expect(screen.getByRole("alert").textContent).toContain("1,000 to 10,000 characters after trimming");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables all existing controls during a second pending generation and unlocks them afterward", async () => {
    const pending = deferred<Response>();
    stubFetch(successResponse(), pending.promise);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    await waitForQuestion(FIRST_PROPOSALS[0].question);
    await generate(user);

    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Generating flashcards…" }).disabled).toBe(true);
    });
    expect(source.disabled).toBe(true);
    for (const field of screen.getAllByRole<HTMLTextAreaElement>("textbox", { name: /Question|Answer/ })) {
      expect(field.disabled).toBe(true);
    }
    for (const button of screen.getAllByRole<HTMLButtonElement>("button", { name: /Reject card/ })) {
      expect(button.disabled).toBe(true);
    }
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save selected" }).disabled).toBe(true);

    pending.resolve(successResponse(REPLACEMENT_PROPOSALS));
    const replacement = await waitForQuestion(REPLACEMENT_PROPOSALS[0].question);
    expect(source.disabled).toBe(false);
    expect(replacement.disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Generate another set" }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save selected" }).disabled).toBe(false);
  });

  it.each([
    ["provider_timeout", "Generation took too long"],
    ["provider_failure", "AI generation is temporarily unavailable"],
    ["malformed_output", "The AI returned an unreadable response"],
    ["no_usable_proposals", "No useful flashcards could be generated"],
  ])("shows a recoverable %s error while preserving the source", async (code, message) => {
    const fetchMock = stubFetch(errorResponse(code));
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(source.value).toBe(VALID_SOURCE);
    expect(source.disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Generate flashcards" }).disabled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a rejected request", new Error("network unavailable")],
    ["an unreadable endpoint response", new Response("not-json", { status: 502 })],
  ])("shows a generic retryable error for %s", async (_label, result) => {
    stubFetch(result);
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Generation failed. Your source text is preserved; please try again.",
    );
    expect(source.value).toBe(VALID_SOURCE);
    expect(source.disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Generate flashcards" }).disabled).toBe(false);
  });

  it("clears an error and installs editable accepted proposals after a successful retry", async () => {
    stubFetch(errorResponse("provider_failure"), successResponse(REPLACEMENT_PROPOSALS));
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    await screen.findByRole("alert");
    await generate(user);

    const question = await waitForQuestion(REPLACEMENT_PROPOSALS[0].question);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(question.value).toBe(REPLACEMENT_PROPOSALS[0].question);
    expect(question.disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Reject card 1" })).toBeTruthy();
  });

  it("preserves edits and rejection after failure, then replaces them only after a later success", async () => {
    stubFetch(successResponse(), errorResponse("provider_failure"), successResponse(REPLACEMENT_PROPOSALS));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    const firstQuestion = await waitForQuestion(FIRST_PROPOSALS[0].question);
    await user.clear(firstQuestion);
    await user.type(firstQuestion, "Edited first question?");
    await user.click(screen.getByRole("button", { name: "Reject card 2" }));

    await generate(user);
    await screen.findByRole("alert");
    expect(source.value).toBe(VALID_SOURCE);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Question", description: /22\/200/ }).value).toBe(
      "Edited first question?",
    );
    expect(screen.getByRole("button", { name: "Restore card 2" })).toBeTruthy();

    await generate(user);
    const replacement = await waitForQuestion(REPLACEMENT_PROPOSALS[0].question);
    expect(replacement.value).toBe(REPLACEMENT_PROPOSALS[0].question);
    expect(screen.queryByDisplayValue("Edited first question?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Restore card 2" })).toBeNull();
  });

  it("keeps proposals unchanged when replacement confirmation is cancelled", async () => {
    const fetchMock = stubFetch(successResponse());
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    const firstQuestion = await waitForQuestion(FIRST_PROPOSALS[0].question);
    await user.clear(firstQuestion);
    await user.type(firstQuestion, "Keep this edit?");
    await generate(user);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstQuestion.value).toBe("Keep this edit?");
    expect(screen.getAllByRole("button", { name: /Reject card/ })).toHaveLength(2);
  });

  it("blocks saving when every card is rejected and enables it after restoring a valid card", async () => {
    const fetchMock = stubFetch(successResponse());
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    await waitForQuestion(FIRST_PROPOSALS[0].question);
    await user.click(screen.getByRole("button", { name: "Reject card 1" }));
    await user.click(screen.getByRole("button", { name: "Reject card 2" }));

    const saveButton = screen.getByRole<HTMLButtonElement>("button", { name: "Save selected" });
    expect(saveButton.disabled).toBe(true);
    expect(screen.getByText("No accepted valid cards remain. This is a valid no-save outcome.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Restore card 1" }));
    expect(saveButton.disabled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows neutral sparse copy only for a small proposal set", async () => {
    const normalSet = Array.from({ length: 5 }, (_, index) => ({
      question: `Normal question ${index + 1}?`,
      answer: `Normal answer ${index + 1}.`,
    }));
    stubFetch(successResponse(REPLACEMENT_PROPOSALS, true), successResponse(normalSet, false));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    expect((await screen.findByRole("status")).textContent).toBe(
      "Fewer than five proposals were returned. Review them against your source.",
    );

    await generate(user);
    await screen.findByDisplayValue(normalSet[0].question);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("FlashcardWorkspace persistence recovery", () => {
  it("submits only accepted-valid edits and preserves the entire reviewed set after definitive failure", async () => {
    const fetchMock = stubFetch(successResponse(REVIEWED_PROPOSALS), errorResponse("save_failed", 503));
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    const acceptedQuestion = await waitForQuestion(REVIEWED_PROPOSALS[0].question);
    await user.clear(acceptedQuestion);
    await user.type(acceptedQuestion, "Edited accepted question?");
    await user.click(screen.getByRole("button", { name: "Reject card 2" }));
    await user.clear(screen.getByDisplayValue(REVIEWED_PROPOSALS[2].question));
    await user.click(screen.getByRole("button", { name: "Save selected" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Your reviewed set is preserved");
    const saveInit = fetchMock.mock.calls[1][1];
    if (typeof saveInit?.body !== "string") throw new Error("Expected the save request body to be JSON text");
    const saveBody = JSON.parse(saveInit.body) as {
      proposals: { id: string; question: string; answer: string }[];
    };
    expect(saveBody.proposals).toHaveLength(1);
    expect(typeof saveBody.proposals[0].id).toBe("string");
    expect({ question: saveBody.proposals[0].question, answer: saveBody.proposals[0].answer }).toEqual({
      question: "Edited accepted question?",
      answer: REVIEWED_PROPOSALS[0].answer,
    });
    expect(source.value).toBe(VALID_SOURCE);
    expect(screen.getByDisplayValue("Edited accepted question?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore card 2" })).toBeTruthy();
    expect(screen.getByDisplayValue(REVIEWED_PROPOSALS[1].answer)).toBeTruthy();
    expect(screen.getByDisplayValue(REVIEWED_PROPOSALS[2].answer)).toBeTruthy();
    expect(screen.getAllByRole<HTMLTextAreaElement>("textbox", { name: "Question" })[2].value).toBe("");
  });

  it("uses one read-only reconciliation after an ambiguous save without replaying the insert", async () => {
    const fetchMock = stubFetch(
      successResponse(REPLACEMENT_PROPOSALS),
      new Error("response lost"),
      errorResponse("save_ambiguous", 503),
    );
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    await waitForQuestion(REPLACEMENT_PROPOSALS[0].question);
    await user.click(screen.getByRole("button", { name: "Save selected" }));

    expect((await screen.findByRole("alert")).textContent).toContain("could not be confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const saveCalls = fetchMock.mock.calls.slice(1).map(([, init]) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON save request");
      return JSON.parse(init.body) as { proposals: unknown[]; reconcile?: boolean };
    });
    expect(saveCalls.map(({ reconcile }) => reconcile)).toEqual([undefined, true]);
    expect(saveCalls.map(({ proposals }) => proposals.length)).toEqual([1, 1]);
    expect(source.value).toBe(VALID_SOURCE);
    expect(screen.getByDisplayValue(REPLACEMENT_PROPOSALS[0].question)).toBeTruthy();
  });

  it("reports the exact saved count and clears the source only after confirmed success", async () => {
    stubFetch(successResponse(FIRST_PROPOSALS), Response.json({ savedCount: 2 }));
    const { user, source } = renderWorkspace();
    setSource(source);

    await generate(user);
    await waitForQuestion(FIRST_PROPOSALS[0].question);
    await user.click(screen.getByRole("button", { name: "Save selected" }));

    expect((await screen.findByText("2 cards were saved.")).textContent).toBe("2 cards were saved.");
    expect(source.value).toBe("");
    expect(screen.getByText("Success: 2 cards were saved.")).toBeTruthy();
  });
});
