// risk: context/foundation/test-plan.md #3 — selected-card failure recovery and durability
// seed: canonical project E2E exemplar
import { expect, test } from "./fixtures";

interface SaveIntent {
  proposals: { id: string; question: string; answer: string }[];
}

test.describe("Risk #3 — selected-card failure recovery and durability", () => {
  test("selected edit survives a failed save and persists after a real retry and reload", async ({ page }) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const source = `Risk #3 persistence source ${uniqueSuffix}. ${"This focused learning material supplies enough deterministic content for browser review. ".repeat(15)}`;
    const originalQuestion = `Which selected card should persist for ${uniqueSuffix}?`;
    const editedQuestion = `Which edited card persisted for ${uniqueSuffix}?`;
    const selectedAnswer = `Only the selected edit ${uniqueSuffix} should survive.`;
    const rejectedQuestion = `Which rejected card must stay absent for ${uniqueSuffix}?`;
    const rejectedAnswer = `The rejected card ${uniqueSuffix} must not be stored.`;
    const invalidQuestion = `Which accepted invalid card must stay absent for ${uniqueSuffix}?`;
    const invalidAnswer = `The accepted invalid card ${uniqueSuffix} must not be stored.`;
    let failedSaveIntent: SaveIntent | undefined;

    await page.route("**/api/flashcards/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          proposals: [
            { question: originalQuestion, answer: selectedAnswer },
            { question: rejectedQuestion, answer: rejectedAnswer },
            { question: invalidQuestion, answer: invalidAnswer },
          ],
          sparse: true,
        }),
      });
    });

    await page.route(
      "**/api/flashcards/save",
      async (route, request) => {
        failedSaveIntent = request.postDataJSON() as SaveIntent;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "save_failed" } }),
        });
      },
      { times: 1 },
    );

    // Generate a deterministic mixed proposal set in the real authenticated workspace.
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "AI flashcard workspace" })).toBeVisible();
    const sourceInput = page.getByRole("textbox", { name: "Source text" });
    await expect(async () => {
      await sourceInput.fill("");
      await sourceInput.fill(source);
      await expect(page.getByText(`${source.trim().length.toLocaleString()} / 10,000`)).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: "Generate flashcards" }).click();
    const proposalRegion = page.getByRole("region", { name: "Review proposals" });
    await expect(proposalRegion).toBeVisible();

    // Edit one accepted card, reject another, and leave the third accepted but invalid.
    const selectedCard = proposalRegion
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Card 1", exact: true }) });
    const rejectedCard = proposalRegion
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Card 2", exact: true }) });
    const invalidCard = proposalRegion
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Card 3", exact: true }) });
    const selectedQuestionInput = selectedCard.getByRole("textbox", { name: "Question" });
    const rejectedQuestionInput = rejectedCard.getByRole("textbox", { name: "Question" });
    const rejectedAnswerInput = rejectedCard.getByRole("textbox", { name: "Answer" });
    const invalidQuestionInput = invalidCard.getByRole("textbox", { name: "Question" });
    await selectedQuestionInput.fill(editedQuestion);
    await proposalRegion.getByRole("button", { name: "Reject card 2" }).click();
    await invalidQuestionInput.fill("");
    await expect(proposalRegion.getByText("2 accepted / 3 total · 1 valid")).toBeVisible();

    // The first save fails definitively and exposes only the edited valid card as its intent.
    const failedSaveResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/flashcards/save") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save selected" }).click();
    const failedSaveResponse = await failedSaveResponsePromise;
    expect(failedSaveResponse.status()).toBe(503);
    expect(failedSaveIntent?.proposals).toHaveLength(1);
    expect(failedSaveIntent?.proposals[0]).toEqual({
      id: expect.any(String),
      question: editedQuestion,
      answer: selectedAnswer,
    });

    // The complete reviewed state remains visible and editable after the confirmed failure.
    await expect(page.getByRole("alert")).toContainText("Your reviewed set is preserved");
    await expect(sourceInput).toHaveValue(source);
    await expect(selectedQuestionInput).toHaveValue(editedQuestion);
    await expect(selectedQuestionInput).toBeEditable();
    await expect(proposalRegion.getByRole("button", { name: "Restore card 2" })).toBeVisible();
    await expect(rejectedQuestionInput).toHaveValue(rejectedQuestion);
    await expect(rejectedAnswerInput).toHaveValue(rejectedAnswer);
    await expect(invalidQuestionInput).toHaveValue("");
    await expect(invalidCard.getByRole("textbox", { name: "Answer" })).toHaveValue(invalidAnswer);

    // Retry through the real Astro endpoint with the identical selected proposal identity and content.
    const retryRequestPromise = page.waitForRequest(
      (request) => request.url().endsWith("/api/flashcards/save") && request.method() === "POST",
    );
    const retryResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/flashcards/save") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save selected" }).click();
    const [retryRequest, retryResponse] = await Promise.all([retryRequestPromise, retryResponsePromise]);
    const retrySaveIntent = retryRequest.postDataJSON() as SaveIntent;
    expect(retrySaveIntent).toEqual(failedSaveIntent);
    expect(retryRequest.headers()["x-dev-ai-retry"]).toBe("confirmed-failure");
    expect(retryResponse.ok()).toBe(true);
    await expect(page.getByText("Success: 1 card was saved.")).toBeVisible();

    // A real collection load and reload contain only the edited selected card.
    const collectionResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/flashcards/collection") && response.request().method() === "GET",
    );
    await page.getByRole("link", { name: "Collection" }).click();
    await expect(page.getByRole("heading", { name: "Your collection" })).toBeVisible();
    expect((await collectionResponsePromise).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: editedQuestion })).toBeVisible();
    await expect(page.getByText(selectedAnswer)).toBeVisible();
    await expect(page.getByText(rejectedQuestion)).toBeHidden();
    await expect(page.getByText(invalidAnswer)).toBeHidden();

    const reloadResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/flashcards/collection") && response.request().method() === "GET",
    );
    await page.reload();
    expect((await reloadResponsePromise).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: editedQuestion })).toBeVisible();
    await expect(page.getByText(selectedAnswer)).toBeVisible();
    await expect(page.getByText(rejectedQuestion)).toBeHidden();
    await expect(page.getByText(invalidAnswer)).toBeHidden();
  });
});
