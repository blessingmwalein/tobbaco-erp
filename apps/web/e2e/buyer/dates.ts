import { expect, type Page } from "@playwright/test";

/** Month index (year*12+month) of an ISO day. */
const monthIndex = (iso: string) => {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return y * 12 + (m - 1);
};

/**
 * Choose a range in the portal's date-range picker, the way a person does: open it, step back to the right month,
 * click the first day and then the last day. The picker applies the range once both ends are chosen.
 * `label` is the control's accessible name (e.g. "Sale dates").
 */
export async function pickDateRange(page: Page, label: string, from: string, to: string) {
  await page.getByRole("button", { name: new RegExp(`^${label}:`) }).click();
  const popover = page.locator('[data-radix-popper-content-wrapper]');
  await expect(popover).toBeVisible();
  const now = new Date();
  const back = now.getFullYear() * 12 + now.getMonth() - monthIndex(from);
  for (let i = 0; i < back; i++) await popover.getByRole("button", { name: /previous month/i }).click();
  await popover.locator(`[data-day="${from}"]:not([data-outside="true"]) button`).click();
  await popover.locator(`[data-day="${to}"]:not([data-outside="true"]) button`).click();
  await expect(popover).toBeHidden();
}

/** Local calendar date "yyyy-mm-dd" — what the picker's presets produce. */
export const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
