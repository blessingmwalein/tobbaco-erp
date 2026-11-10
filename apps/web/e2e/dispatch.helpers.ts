import { expect, type Page } from "@playwright/test";
import { go } from "./helpers";

/** The five documented ticket barcodes: V100060 × 3 then V100061 × 2 (masses 112+98+105+101+96 = 512 kg). */
export const TICKETS = ["1000001013", "1000001024", "1000001035", "1000001046", "1000001057"] as const;

/** Fill the Initiate Dispatch form on /floor/dispatch and land in the scanning workspace. */
export async function initiateNote(page: Page, opts: { warehouse?: string; truckReg?: string } = {}) {
  await go(page, "/floor/dispatch");
  await page.locator("#di-warehouse").selectOption(opts.warehouse ?? "CURVERID");
  await page.locator("#di-transport").fill("Zim Haulage");
  await page.locator("#di-truck").fill(opts.truckReg ?? "ZAB 1234");
  await page.locator("#di-driver").fill("Moses Phiri");
  await page.locator("#di-driver-id").fill("63-111111-A-11");
  await page.locator("#di-driver-cell").fill("0771111111");
  await page.getByTestId("create-dispatch").click();
  await page.waitForURL(/\/floor\/dispatch\/dispatch-\d+/);
  await expect(page.getByTestId("scanner-input")).toBeVisible();
}

/** Type a barcode into the scanner field + Enter (exactly what a keyboard-wedge scanner does). */
export async function scan(page: Page, barcode: string) {
  const input = page.getByTestId("scanner-input");
  await input.fill(barcode);
  await input.press("Enter");
  await expect(page.getByTestId("scan-feedback")).toContainText(barcode);
}

export async function confirmPost(page: Page) {
  await page.getByTestId("post-dispatch").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText("Dispatch note posted").first()).toBeVisible();
}
