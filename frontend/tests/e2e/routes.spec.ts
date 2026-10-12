/**
 * Route smoke tests — every page must render without crashing.
 *
 * Auth strategy: inject a fake WorkOS session cookie before each test so
 * authkitMiddleware() treats the request as authenticated. This avoids
 * hitting the real WorkOS login page.
 *
 * The cookie name and shape must match what @workos-inc/authkit-nextjs expects.
 * Update WORKOS_SESSION_COOKIE_NAME and fakeSession if the SDK version changes.
 */
import { test, expect, BrowserContext } from "@playwright/test";

const WORKOS_SESSION_COOKIE_NAME = "wos-session";

const fakeSession = {
  user: {
    id: "test-user-id",
    email: "test@test.com",
    platform_role: "investor",
  },
  accessToken: "fake-token",
};

async function injectSession(context: BrowserContext) {
  await context.addCookies([
    {
      name: WORKOS_SESSION_COOKIE_NAME,
      value: Buffer.from(JSON.stringify(fakeSession)).toString("base64"),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
    },
  ]);
}

test.beforeEach(async ({ context }) => {
  await injectSession(context);
});

const routes = [
  { path: "/dashboard",                              selector: "nav"              },
  { path: "/investments",                            selector: "[data-testid='investments-page']" },
  { path: "/projects/new",                           selector: "form"             },
  { path: "/projects/test-project-id",               selector: "[data-testid='project-hub']"    },
  { path: "/projects/test-project-id/assets",        selector: "[data-testid='asset-list']"     },
  { path: "/projects/test-project-id/flow",          selector: "[data-testid='flow-canvas']"    },
  { path: "/projects/test-project-id/flow/test-cell", selector: "[data-testid='cell-chat']"    },
  { path: "/admin/settings/flow-template",           selector: "[data-testid='template-editor']"},
];

for (const { path, selector } of routes) {
  test(`${path} renders without crashing`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(path);
    await expect(page.locator(selector).first()).toBeVisible({ timeout: 8000 });
    expect(errors).toHaveLength(0);
  });
}

test("sidebar navigation is present on all authenticated pages", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("nav")).toBeVisible();
  await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /investments/i })).toBeVisible();
});
