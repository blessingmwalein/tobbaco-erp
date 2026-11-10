import { expect, type Page } from "@playwright/test";
import { go } from "./helpers";

/** Drive the Receiving workspace through the UI exactly as the clerk would (Manual 03, Steps 1–3). */
export async function createTransporterNote(page: Page) {
  await go(page, "/floor/receiving");
  await page.getByLabel(/Transporter Name/).fill("Tendai Moyo");
  await page.getByLabel(/ID Number/).fill("63-123456-A-42");
  await page.getByLabel(/Vehicle Reg/).fill("AEX 1234");
  await expect(page.getByText("Saved as AEX1234")).toBeVisible(); // spaces are removed automatically
  await page.getByLabel(/Phone Number/).fill("0772123456");
  await page.getByTestId("transporter-submit").click();
  await expect(page.getByTestId("note-stats")).toBeVisible();
}

export async function addGrower(page: Page, digits: string, bales: string) {
  await page.getByLabel(/Grower No\./).fill(digits);
  await page.getByLabel(/Number of Bales/).fill(bales);
  await page.getByTestId("add-grower").click();
  await expect(page.getByTestId("note-growers")).toContainText(`V${digits}`);
}

/** The documented truck: Tendai Moyo, AEX 1234, V100060 × 3 and V100061 × 2. Optionally completes the note. */
export async function createDocumentedTruck(page: Page, opts: { complete?: boolean } = {}) {
  await createTransporterNote(page);
  await addGrower(page, "100060", "3");
  await addGrower(page, "100061", "2");
  if (opts.complete === false) return;
  await page.getByTestId("complete-delivery").click();
  await page.getByTestId("confirm-delivery-complete").click();
  await expect(page.getByTestId("note-closed")).toBeVisible();
}

/** Save one bale on the bale-capture form using the keyboard path: scan → Enter → group → Enter → lot → Enter saves. */
export async function saveBale(page: Page, scaleBarcode: string, group: string, lot: string, growerDigits?: string) {
  if (growerDigits) await page.getByTestId("bale-grower").fill(growerDigits);
  await page.getByTestId("bale-barcode").fill(scaleBarcode);
  await page.getByTestId("bale-group").fill(group);
  await page.getByTestId("bale-lot").fill(lot);
  await page.getByTestId("bale-lot").press("Enter");
}

export async function expectFeedback(page: Page, text: string | RegExp) {
  await expect(page.getByTestId("capture-feedback")).toContainText(text);
}

export async function setStartBarcode(page: Page, barcode: string) {
  await page.getByTestId("set-start-barcode").click();
  await page.getByTestId("start-barcode-input").fill(barcode);
  await page.getByTestId("confirm-start-barcode").click();
}
