import { expect, type Page } from "@playwright/test";

export type ScenarioId =
  | "FRESH"
  | "START_OF_DAY"
  | "BOOKINGS_IMPORTED"
  | "RECEIVING_IN_PROGRESS"
  | "RECEIVED"
  | "TICKETS_CONFIRMED"
  | "FLOOR_SUMMARY_DONE"
  | "READY_TO_BALANCE"
  | "BALANCED"
  | "PROCESSED"
  | "READY_TO_DISPATCH"
  | "VALIDATION_SHOWCASE";

/** Sign in as a demo role (login page buttons are `login-as-<roleId>`), with no artificial latency. */
export async function signInAs(page: Page, roleId: string, path = "/login") {
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}latency=0`);
  await page.getByTestId(`login-as-${roleId}`).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Fresh demo state from the seed (clears persisted mock data in this browser context). */
export async function resetDemo(page: Page) {
  await page.goto("/login?latency=0");
  await page.waitForFunction(() => Boolean((window as unknown as { __demo?: unknown }).__demo));
  await page.evaluate(() => (window as unknown as { __demo: { resetDb: () => void } }).__demo.resetDb());
}

export async function jumpTo(page: Page, scenario: ScenarioId) {
  await page.waitForFunction(() => Boolean((window as unknown as { __demo?: unknown }).__demo));
  await page.evaluate((s) => (window as unknown as { __demo: { applyScenario: (id: string) => void } }).__demo.applyScenario(s), scenario);
}

/** Client-side navigation that keeps the in-memory demo state (no full reload needed, but reload is also safe). */
export async function go(page: Page, path: string) {
  await page.goto(path.includes("?") ? `${path}&latency=0` : `${path}?latency=0`);
  await expect(page.locator("main, #main").first()).toBeVisible();
}
