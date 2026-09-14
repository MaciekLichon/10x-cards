import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  test as base,
  expect,
  request as requestFactory,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { requireE2EEnvironment } from "./env";

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

export interface E2EUser {
  id: string;
  email: string;
  storageState: StorageState;
}

export interface AuthenticatedContext {
  context: BrowserContext;
  page: Page;
  user: E2EUser;
}

interface UserManager {
  provisionUser(label?: string): Promise<E2EUser>;
}

interface E2EFixtures {
  userManager: UserManager;
  primaryUser: E2EUser;
  createAuthenticatedContext: (label?: string) => Promise<AuthenticatedContext>;
}

async function authenticateThroughApplication(baseURL: string, email: string, password: string): Promise<StorageState> {
  const origin = new URL(baseURL).origin;
  const authRequest = await requestFactory.newContext({ baseURL: origin });

  try {
    const response = await authRequest.post("/api/auth/signin", {
      form: { email, password },
      headers: { Origin: origin },
      maxRedirects: 0,
    });

    if (response.status() !== 302 || response.headers().location !== "/dashboard") {
      throw new Error(`Application sign-in failed with status ${response.status()}.`);
    }

    const storageState = await authRequest.storageState();
    if (storageState.cookies.length === 0) {
      throw new Error("Application sign-in returned no session cookies.");
    }
    return storageState;
  } finally {
    await authRequest.dispose();
  }
}

export const test = base.extend<E2EFixtures>({
  userManager: async ({ baseURL }, provide) => {
    if (!baseURL) throw new Error("Playwright baseURL must be configured for the E2E suite.");

    const environment = requireE2EEnvironment();
    const adminClient = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const registeredUserIds: string[] = [];

    const manager: UserManager = {
      async provisionUser(label = "user") {
        const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
        const email = `e2e-${label}-${uniqueSuffix}@example.test`;
        const password = `Local-only-${randomUUID()}-Aa1!`;
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (error) {
          throw new Error(`Unable to provision a local E2E user: ${error.message}.`);
        }
        registeredUserIds.push(data.user.id);

        const storageState = await authenticateThroughApplication(baseURL, email, password);
        return { id: data.user.id, email, storageState };
      },
    };

    await provide(manager);

    const cleanupErrors: string[] = [];
    for (const userId of registeredUserIds.reverse()) {
      try {
        const { error } = await adminClient.auth.admin.deleteUser(userId, false);
        if (error) cleanupErrors.push(error.message);
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error.message : "unknown deletion failure");
      }
    }

    if (cleanupErrors.length > 0) {
      throw new Error(`Failed to delete ${cleanupErrors.length} E2E fixture user(s): ${cleanupErrors.join("; ")}`);
    }
  },

  primaryUser: async ({ userManager }, provide) => {
    await provide(await userManager.provisionUser("primary"));
  },

  storageState: async ({ primaryUser }, provide) => {
    await provide(primaryUser.storageState);
  },

  createAuthenticatedContext: async ({ baseURL, browser, userManager }, provide) => {
    if (!baseURL) throw new Error("Playwright baseURL must be configured for the E2E suite.");

    const contexts: BrowserContext[] = [];
    await provide(async (label = "additional") => {
      const user = await userManager.provisionUser(label);
      const context = await browser.newContext({ baseURL, storageState: user.storageState });
      contexts.push(context);
      return { context, page: await context.newPage(), user };
    });

    const cleanupErrors: string[] = [];
    for (const context of contexts.reverse()) {
      try {
        await context.close();
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error.message : "unknown context closure failure");
      }
    }
    if (cleanupErrors.length > 0) {
      throw new Error(`Failed to close ${cleanupErrors.length} E2E browser context(s): ${cleanupErrors.join("; ")}`);
    }
  },
});

export { expect };
