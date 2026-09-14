// risk: context/foundation/test-plan.md #1 — invalid AI output leaves generation recoverable
// seed: tests/e2e/seed.spec.ts
import { expect, test } from "./fixtures";

test.describe("Risk #1 — invalid generation recovery", () => {
  test("invalid generation preserves the source and a valid retry remains usable", async ({ page }) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const source = `Risk #1 recovery source ${uniqueSuffix}. ${"This focused learning material must remain available after invalid AI output. ".repeat(16)}`;
    const recoveredSource = `${source} The learner can still edit this source before retrying.`;
    const generatedQuestion = `What proves recovery for ${uniqueSuffix}?`;
    const generatedAnswer = "The preserved source can be retried and the returned proposal remains editable.";
    const editedQuestion = `Which browser behavior proves recovery for ${uniqueSuffix}?`;
    let generationRequestCount = 0;

    await page.route("**/api/flashcards/generate", async (route) => {
      generationRequestCount += 1;

      if (generationRequestCount === 1) {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "malformed_output" } }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          proposals: [{ question: generatedQuestion, answer: generatedAnswer }],
          sparse: true,
        }),
      });
    });

    // Open the real authenticated workspace and submit a unique valid source.
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "AI flashcard workspace" })).toBeVisible();
    const sourceInput = page.getByRole("textbox", { name: "Source text" });
    await expect(async () => {
      await sourceInput.fill("");
      await sourceInput.fill(source);
      await expect(page.getByText(new RegExp(`^${source.trim().length.toLocaleString()} / 10,000$`))).toBeVisible({
        timeout: 500,
      });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: "Generate flashcards" }).click();

    // The representative invalid output is visible while the exact source remains editable.
    await expect(page.getByRole("alert")).toContainText("The AI returned an unreadable response");
    await expect(sourceInput).toHaveValue(source);
    await expect(sourceInput).toBeEditable();
    await sourceInput.fill(recoveredSource);

    // Retry through the same rendered controls and install a valid proposal.
    await page.getByRole("button", { name: "Generate flashcards" }).click();
    const proposalRegion = page.getByRole("region", { name: "Review proposals" });
    await expect(proposalRegion).toBeVisible();
    await expect(page.getByRole("alert")).toBeHidden();
    expect(generationRequestCount).toBe(2);

    // The recovered proposal remains editable and selectable.
    const questionInput = proposalRegion.getByRole("textbox", { name: "Question" });
    await expect(questionInput).toHaveValue(generatedQuestion);
    await questionInput.fill(editedQuestion);
    await expect(questionInput).toHaveValue(editedQuestion);
    await proposalRegion.getByRole("button", { name: "Reject card 1" }).click();
    await expect(proposalRegion.getByRole("button", { name: "Restore card 1" })).toBeVisible();
    await proposalRegion.getByRole("button", { name: "Restore card 1" }).click();
    await expect(proposalRegion.getByRole("button", { name: "Reject card 1" })).toBeVisible();
    await expect(questionInput).toHaveValue(editedQuestion);
  });
});
