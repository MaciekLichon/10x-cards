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
