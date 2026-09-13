import { test, expect } from "./fixtures";

test("created flashcard persists after page reload", async ({ page }) => {
  const uniqueSuffix = Date.now();
  const front = `E2E persistence question ${uniqueSuffix}`;
  const back = `E2E persistence answer ${uniqueSuffix}`;
  let createdFlashcard: { id: string; updatedAt: string } | undefined;

  try {
    await page.goto("/dashboard/collection");
    await expect(page.getByRole("heading", { name: "Your collection" })).toBeVisible();

    const createFlashcard = page.getByRole("region", { name: "Create a flashcard" });
    await createFlashcard.getByRole("button", { name: "Add flashcard" }).click();
    await createFlashcard.getByLabel("Front").fill(front);
    await createFlashcard.getByLabel("Back").fill(back);

    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/flashcards/collection") && response.request().method() === "POST",
    );
    await createFlashcard.getByRole("button", { name: "Save flashcard" }).click();

    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBe(true);
    const body = (await saveResponse.json()) as { flashcard: { id: string; updatedAt: string } };
    createdFlashcard = {
      id: body.flashcard.id,
      updatedAt: body.flashcard.updatedAt,
    };

    await expect(page.getByRole("heading", { name: front })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: front })).toBeVisible();
  } finally {
    if (createdFlashcard) {
      const cleanupResponse = await page.request.delete(`/api/flashcards/${createdFlashcard.id}`, {
        data: createdFlashcard,
        headers: { Origin: "http://localhost:4321" },
      });
      expect.soft(cleanupResponse.ok(), "created flashcard should be removed during cleanup").toBe(true);
    }
  }
});
