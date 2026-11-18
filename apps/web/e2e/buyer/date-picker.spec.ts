import { expect, test } from "@playwright/test";
import { localIso } from "./dates";
import { ACCOUNTS, signInBuyer } from "./helpers";

/** The date pickers that replaced the browser's native date inputs across the Buyer Portal. */
const PAGES: Array<{ path: string; label: RegExp }> = [
  { path: "/buyer/dashboard", label: /^Sale dates:/ },
  { path: "/buyer/purchases", label: /^Purchase dates:/ },
  { path: "/buyer/invoices", label: /^Sale date:/ },
  { path: "/buyer/inventory", label: /^Received dates:/ },
  { path: "/buyer/movements", label: /^Movement dates:/ },
  { path: "/buyer/shipments", label: /^Dispatch dates:/ },
  { path: "/buyer/reconciliation", label: /^Purchase dates:/ },
  { path: "/buyer/receiving/reconciliation", label: /^Started dates:/ },
  { path: "/buyer/reports/purchases", label: /^Sale date:/ },
];

test.describe("Date pickers (Buyer Portal)", () => {
  test("every date filter is a picker, never a native date input", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    for (const { path, label } of PAGES) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: label }).first(), `${path} should have a date-range picker`).toBeVisible();
      await expect(page.locator('input[type="date"]'), `${path} still has a native date input`).toHaveCount(0);
    }
  });

  test("opens from the keyboard, closes with Escape and returns focus to the control", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await page.goto("/buyer/dashboard");
    const trigger = page.getByRole("button", { name: /^Sale dates:/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("grid").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("grid")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("a quick range applies at once and uses local calendar dates (no off-by-one)", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await page.goto("/buyer/reports/purchases");
    await page.getByRole("button", { name: /^Sale date:/ }).click();
    await page.getByTestId("range-preset-last-7").click();
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    await expect(page).toHaveURL(new RegExp(`from=${localIso(start)}`));
    await expect(page).toHaveURL(new RegExp(`to=${localIso(today)}`));
  });

  test("can be cleared with the × button", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await page.goto("/buyer/reports/purchases?from=2026-05-01&to=2026-05-31");
    await expect(page.getByRole("button", { name: /^Sale date:/ })).toContainText("1 May 2026 – 31 May 2026");
    await page.getByRole("button", { name: "Clear Sale date" }).click();
    await expect(page).not.toHaveURL(/from=/);
    await expect(page.getByRole("button", { name: /^Sale date:/ })).toContainText("Any date");
  });

  test("shows one month on a phone and two on a desktop", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await page.goto("/buyer/dashboard");
    await page.getByRole("button", { name: /^Sale dates:/ }).click();
    await expect(page.getByRole("grid")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /^Sale dates:/ }).click();
    await expect(page.getByRole("grid")).toHaveCount(1);
  });

  test("the single-date picker works inside the shipment import dialog", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await page.goto("/buyer/shipments");
    await page.getByRole("button", { name: /import/i }).first().click();
    const picker = page.getByRole("button", { name: /^Dispatch date:/ });
    await expect(picker).toBeVisible();
    await picker.click();
    await page.locator('[data-radix-popper-content-wrapper] [data-day]:not([data-outside="true"]) button').first().click();
    await expect(picker).not.toContainText("Use the date in the file");
  });
});
