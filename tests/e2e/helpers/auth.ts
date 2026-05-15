import type { Page } from "@playwright/test";

export async function setAuthTokens(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "e2e-token");
    window.localStorage.setItem("refresh_token", "e2e-refresh");
  });
}
