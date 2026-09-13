// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import FlashcardCollection from "@/components/flashcards/FlashcardCollection";
import type { CollectionFlashcard } from "@/lib/flashcards";

import "../../setup-dom";

const TARGET: CollectionFlashcard = {
  id: "11111111-1111-4111-8111-111111111111",
  front: "Target front",
  back: "Target back",
  createdAt: "2026-09-12T10:00:00.000Z",
  updatedAt: "2026-09-12T10:00:00.000Z",
};
const DECOY: CollectionFlashcard = {
  id: "22222222-2222-4222-8222-222222222222",
  front: "Decoy front",
  back: "Decoy back",
  createdAt: "2026-09-11T10:00:00.000Z",
  updatedAt: "2026-09-11T10:00:00.000Z",
};
const UPDATED_TARGET: CollectionFlashcard = {
  ...TARGET,
  front: "Edited target front",
  back: "Edited target back",
  updatedAt: "2026-09-13T10:00:00.000Z",
};

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

function collectionResponse(flashcards: CollectionFlashcard[]): Response {
  return Response.json({ flashcards, nextCursor: null });
}

function mutationError(code: string): Response {
  return Response.json({ error: { code } }, { status: 503 });
}

function stubFetch(...results: (Response | Promise<Response> | Error)[]): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>();
  for (const result of results) {
    if (result instanceof Error) fetchMock.mockRejectedValueOnce(result);
    else fetchMock.mockImplementationOnce(() => Promise.resolve(result));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function cardFor(text: string): HTMLElement {
  const card = screen.getByText(text).closest("article");
  if (!card) throw new Error(`Expected an article containing ${text}`);
  return card;
}

async function renderCollection() {
  const user = userEvent.setup();
  render(<FlashcardCollection />);
  await screen.findByText(TARGET.front);
  return { user };
}

async function editTarget(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const card = cardFor(TARGET.front);
  await user.click(within(card).getByRole("button", { name: "Edit flashcard" }));
  const front = within(card).getByRole<HTMLTextAreaElement>("textbox", { name: "Front" });
  const back = within(card).getByRole<HTMLTextAreaElement>("textbox", { name: "Back" });
  await user.clear(front);
  await user.type(front, UPDATED_TARGET.front);
  await user.clear(back);
  await user.type(back, UPDATED_TARGET.back);
  await user.click(within(card).getByRole("button", { name: "Save" }));
}

async function deleteTarget(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(within(cardFor(TARGET.front)).getByRole("button", { name: "Delete flashcard" }));
  const dialog = screen.getByRole("dialog", { name: "Delete this flashcard?" });
  await user.click(within(dialog).getByRole("button", { name: "Delete flashcard" }));
}

describe("FlashcardCollection recovery and target identity", () => {
  it("shows initial loading until the first queued collection response arrives", async () => {
    const pending = deferred<Response>();
    stubFetch(pending.promise);
    render(<FlashcardCollection />);

    expect(screen.getByRole("status").textContent).toContain("Loading your collection");
    pending.resolve(collectionResponse([TARGET, DECOY]));

    expect(await screen.findByText(TARGET.front)).toBeTruthy();
    expect(screen.getByText(DECOY.front)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps the exact edit draft open and scopes a definitive PATCH failure to the target", async () => {
    stubFetch(collectionResponse([TARGET, DECOY]), mutationError("update_failed"));
    const { user } = await renderCollection();

    await editTarget(user);

    const targetCard = cardFor(UPDATED_TARGET.front);
    expect((await within(targetCard).findByRole("alert")).textContent).toContain("Your draft is preserved");
    expect(within(targetCard).getByRole<HTMLTextAreaElement>("textbox", { name: "Front" }).value).toBe(
      UPDATED_TARGET.front,
    );
    expect(within(targetCard).getByRole<HTMLTextAreaElement>("textbox", { name: "Back" }).value).toBe(
      UPDATED_TARGET.back,
    );
    expect(cardFor(DECOY.front).querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps target and decoy visible and scopes a definitive DELETE failure to the target", async () => {
    stubFetch(collectionResponse([TARGET, DECOY]), mutationError("delete_failed"));
    const { user } = await renderCollection();

    await deleteTarget(user);

    const targetCard = cardFor(TARGET.front);
    expect((await within(targetCard).findByRole("alert")).textContent).toContain("not deleted");
    expect(screen.getByText(DECOY.front)).toBeTruthy();
    expect(cardFor(DECOY.front).querySelector('[role="alert"]')).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Delete this flashcard?" })).toBeNull();
  });

  it("applies a successful PATCH only to the matching card ID", async () => {
    stubFetch(collectionResponse([TARGET, DECOY]), Response.json({ flashcard: UPDATED_TARGET }));
    const { user } = await renderCollection();

    await editTarget(user);

    expect(await screen.findByText(UPDATED_TARGET.front)).toBeTruthy();
    expect(screen.getByText(UPDATED_TARGET.back)).toBeTruthy();
    expect(screen.queryByText(TARGET.front)).toBeNull();
    expect(screen.getByText(DECOY.front)).toBeTruthy();
    expect(screen.getByText(DECOY.back)).toBeTruthy();
    expect(cardFor(UPDATED_TARGET.front).dataset.cardId).toBe(TARGET.id);
    expect(cardFor(DECOY.front).dataset.cardId).toBe(DECOY.id);
  });

  it("reconciles an ambiguous PATCH with one read-only rebuild and no mutation replay", async () => {
    const fetchMock = stubFetch(
      collectionResponse([TARGET, DECOY]),
      mutationError("mutation_ambiguous"),
      collectionResponse([UPDATED_TARGET, DECOY]),
    );
    const { user } = await renderCollection();

    await editTarget(user);

    expect(await screen.findByText(UPDATED_TARGET.front)).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual(["GET", "PATCH", "GET"]);
    expect(screen.getByText(DECOY.front)).toBeTruthy();
  });

  it("reconciles an ambiguous DELETE with one read-only rebuild and no mutation replay", async () => {
    const fetchMock = stubFetch(
      collectionResponse([TARGET, DECOY]),
      mutationError("mutation_ambiguous"),
      collectionResponse([DECOY]),
    );
    const { user } = await renderCollection();

    await deleteTarget(user);

    await waitFor(() => {
      expect(screen.queryByText(TARGET.front)).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual(["GET", "DELETE", "GET"]);
    expect(screen.getByText(DECOY.front)).toBeTruthy();
  });
});
