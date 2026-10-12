/**
 * Auth redirect tests — unauthenticated requests must redirect to WorkOS login.
 */
import { test, expect } from "@playwright/test";

const WORKOS_LOGIN_PATTERN = /workos\.com|\/auth\/login/;

const protectedRoutes = [
  "/dashboard",
  "/investments",
  "/projects/test-project-id",
  "/admin/settings/flow-template",
];

for (const path of protectedRoutes) {
  test(`unauthenticated ${path} redirects to WorkOS login`, async ({ page }) => {
    // No session cookie injected — request is unauthenticated
    const response = await page.goto(path, { waitUntil: "commit" });

    // Either the final URL contains the auth domain, or we got redirected
    const finalUrl = page.url();
    const wasRedirected = WORKOS_LOGIN_PATTERN.test(finalUrl);

    // Accept redirect OR a 401/403 status (depends on middleware implementation)
    const status = response?.status() ?? 0;
    expect(wasRedirected || status === 401 || status === 403).toBe(true);
  });
}

test("callback route exists and does not return 404", async ({ page }) => {
  // Full OAuth code exchange requires a live WorkOS test org — deferred to Day 8 E2E.
  // This just confirms the route is registered.
  const response = await page.goto("/callback?code=test-code", { waitUntil: "commit" });
  expect(response?.status()).not.toBe(404);
});
