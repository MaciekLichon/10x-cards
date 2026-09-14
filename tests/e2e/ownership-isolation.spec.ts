// risk: context/foundation/test-plan.md #4 — anonymous and cross-account read isolation
// seed: tests/e2e/seed.spec.ts
import { expect, test } from "./fixtures";

test.describe("Risk #4 — anonymous and cross-account read isolation", () => {
  test("anonymous and other-user sessions cannot read an owner's durable card", async ({
    baseURL,
    browser,
    createAuthenticatedContext,
    page,
  }) => {
    if (!baseURL) throw new Error("Playwright baseURL must be configured for the E2E suite.");

    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const ownerFront = `Owner-only question ${uniqueSuffix}`;
    const ownerBack = `Owner-only answer ${uniqueSuffix}`;
    const anonymousContext = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const anonymousPage = await anonymousContext.newPage();

      // An explicit cookie-free browser session is denied by the protected page and collection API.
      await anonymousPage.goto("/dashboard/collection");
      await expect(anonymousPage).toHaveURL("/auth/signin");
      await expect(anonymousPage.getByRole("heading", { name: "Sign in" })).toBeVisible();
      const anonymousApiResponse = await anonymousContext.request.get("/api/flashcards/collection");
      expect(anonymousApiResponse.status()).toBe(401);
      expect(await anonymousApiResponse.json()).toEqual({
        error: {
          code: "unauthenticated",
          message: "Sign in to view your collection.",
        },
      });

      // The owner creates a unique card through the rendered collection UI and the real persistence boundary.
      const ownerInitialLoadPromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/flashcards/collection") && response.request().method() === "GET",
      );
      await page.goto("/dashboard/collection");
      expect((await ownerInitialLoadPromise).ok()).toBe(true);
      await expect(page.getByRole("heading", { name: "Your collection is empty" })).toBeVisible();
      const createCardRegion = page.getByRole("region", { name: "Create a flashcard" });
      await createCardRegion.getByRole("button", { name: "Add flashcard" }).click();
      await createCardRegion.getByRole("textbox", { name: "Front" }).fill(ownerFront);
      await createCardRegion.getByRole("textbox", { name: "Back" }).fill(ownerBack);
      const ownerSaveResponsePromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/flashcards/collection") && response.request().method() === "POST",
      );
      const ownerRefreshResponsePromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/flashcards/collection") && response.request().method() === "GET",
      );
      await createCardRegion.getByRole("button", { name: "Save flashcard" }).click();
      expect((await ownerSaveResponsePromise).ok()).toBe(true);
      expect((await ownerRefreshResponsePromise).ok()).toBe(true);
      await expect(page.getByRole("heading", { name: ownerFront })).toBeVisible();
      await expect(page.getByText(ownerBack)).toBeVisible();

      // A separately authenticated user's completed collection load excludes the owner's exact content.
      const other = await createAuthenticatedContext("other");
      const otherCollectionResponsePromise = other.page.waitForResponse(
        (response) => response.url().endsWith("/api/flashcards/collection") && response.request().method() === "GET",
      );
      await other.page.goto("/dashboard/collection");
      expect((await otherCollectionResponsePromise).ok()).toBe(true);
      await expect(other.page.getByRole("heading", { name: "Your collection is empty" })).toBeVisible();
      await expect(other.page.getByText(ownerFront)).toBeHidden();
      await expect(other.page.getByText(ownerBack)).toBeHidden();

      // The owner's real reload still contains the exact durable card after the denied reads.
      const ownerReloadResponsePromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/flashcards/collection") && response.request().method() === "GET",
      );
      await page.reload();
      expect((await ownerReloadResponsePromise).ok()).toBe(true);
      await expect(page.getByRole("heading", { name: ownerFront })).toBeVisible();
      await expect(page.getByText(ownerBack)).toBeVisible();
    } finally {
      await anonymousContext.close();
    }
  });
});
