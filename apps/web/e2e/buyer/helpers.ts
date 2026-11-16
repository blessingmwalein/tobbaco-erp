import { expect, type Page } from "@playwright/test";

/** Seeded demo accounts (apps/api/prisma/seed-data.ts). All share the seed password. */
export const BUYER_PASSWORD = process.env.E2E_BUYER_PASSWORD ?? "Test-Password-2026";
export const ACCOUNTS = {
  admin: "admin@moroz-demo.test",
  warehouse: "warehouse@moroz-demo.test",
  operations: "operations@moroz-demo.test",
  finance: "finance@moroz-demo.test",
  viewer: "viewer@moroz-demo.test",
  otherBuyerAdmin: "admin@kt-demo.test",
} as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Open a public auth page and wait until React has hydrated (before that, a click would be a native form submit). */
export async function gotoAuthPage(page: Page, path: string) {
  await page.goto(path);
  await page.locator('main[data-hydrated="true"]').waitFor();
}

/** Sign in through the real form and wait for the portal shell. */
export async function signInBuyer(page: Page, email: string, password = BUYER_PASSWORD, next?: string) {
  await gotoAuthPage(page, next ? `/buyer/login?next=${encodeURIComponent(next)}` : "/buyer/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByTestId("buyer-sign-in").click();
  await expect(page.getByTestId("buyer-user-menu")).toBeVisible();
}

export async function signOutBuyer(page: Page) {
  await page.getByTestId("buyer-user-menu").click();
  await page.getByTestId("buyer-sign-out").click();
  await page.waitForURL(/\/buyer\/login/);
}

/** The sidebar links the signed-in role can see. */
export async function navLabels(page: Page): Promise<string[]> {
  return page.getByRole("navigation", { name: "Buyer Portal" }).getByRole("link").allTextContents();
}
