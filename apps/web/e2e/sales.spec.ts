import { expect, test, type Page } from "@playwright/test";
import { go, jumpTo, resetDemo, signInAs } from "./helpers";

/** Slice C: floor summary, data capture, batches, balancing, approvals — on the documented 17 Sep 2026 data. */

async function scan(page: Page, barcode: string) {
  const input = page.getByTestId("scanner-input");
  await input.fill(barcode);
  await input.press("Enter");
}

async function openScanScreen(page: Page) {
  await go(page, "/floor/floor-summary");
  await page.getByTestId("select-selling-point-EL").click();
  await page.getByTestId("select-sale-room-A").click();
  await expect(page.getByTestId("floor-row")).toBeVisible();
}

test.describe("floor summary", () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "TICKETS_CONFIRMED");
  });

  test("scan V100060 into row 1 and V100061 into row 2 → Scanned 3 of 3, deliveries Laid, draft sales created", async ({ page }) => {
    await openScanScreen(page);
    await scan(page, "1000001013");
    await expect(page.getByTestId("scan-feedback")).toContainText("Scanned 1 of 3");
    await scan(page, "1000001024");
    await expect(page.getByTestId("scan-feedback")).toContainText("Scanned 2 of 3");
    await scan(page, "1000001035");
    await expect(page.getByTestId("scan-feedback")).toContainText("Scanned 3 of 3");
    await expect(page.getByTestId("last-scan")).toContainText("V100060");
    await expect(page.getByTestId("last-scan")).toContainText("Floor summary complete");

    await page.getByTestId("floor-row").fill("2");
    await scan(page, "1000001046");
    await scan(page, "1000001057");
    await expect(page.getByTestId("scan-feedback")).toContainText("Scanned 2 of 2");
    await expect(page.getByTestId("row-summary")).toContainText("Row 1");
    await expect(page.getByTestId("row-summary")).toContainText("Row 2");

    await go(page, "/sales");
    const table = page.getByTestId("sales-table");
    await expect(table).toContainText("V100060");
    await expect(table.locator("tr", { hasText: "V100061" })).toContainText("Draft");
    await go(page, "/floor-summary");
    await expect(page.getByTestId("floor-summary-table")).toContainText("GDN0000005");
  });

  test("rejects unknown barcodes, scale labels and duplicates with the documented messages", async ({ page }) => {
    await openScanScreen(page);
    await scan(page, "9999999999");
    await expect(page.getByTestId("scan-feedback")).toContainText("Cannot find the bale: 9999999999");
    await scan(page, "2609170001"); // scale barcode, not the ticket
    await expect(page.getByTestId("scan-feedback")).toContainText("Cannot find the bale: 2609170001");
    await scan(page, "1000001013");
    await scan(page, "1000001013");
    await expect(page.getByTestId("scan-feedback")).toContainText("already scanned");
    // unknown + scale label + duplicate = 3 rejected; the first genuine scan is the 1 accepted
    await expect(page.getByTestId("scan-history")).toContainText("1 ok · 3 rejected");
    // a blank row is refused with the documented message
    await page.getByTestId("floor-row").fill("");
    await scan(page, "1000001024");
    await expect(page.getByTestId("scan-feedback")).toContainText("Please enter a Row Number");
  });

  test("turning scanning off blocks the floor until it is turned on again", async ({ page }) => {
    await openScanScreen(page);
    await page.getByTestId("toggle-scanning").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Turn off scanning" }).click();
    await expect(page.getByTestId("scanning-status")).toContainText("Scanning off");
    await expect(page.getByText("Scanning is not available")).toBeVisible();
    await page.getByTestId("toggle-scanning").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Turn on scanning" }).click();
    await expect(page.getByTestId("scanning-status")).toContainText("Scanning on");
  });

  test("Check Floor Summary answers 'where are my bales?'", async ({ page }) => {
    await jumpTo(page, "FLOOR_SUMMARY_DONE");
    await go(page, "/floor/floor-summary/check");
    await page.getByTestId("check-grower").fill("100060");
    await page.getByTestId("check-submit").click();
    const result = page.getByTestId("check-result");
    await expect(result).toContainText("Grower V100060");
    await expect(result).toContainText("GDN0000005");
    await expect(result.locator("tbody tr").first()).toContainText("3");
  });
});

test.describe("data capture and batches", () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "FLOOR_SUMMARY_DONE");
  });

  test("e-Buying: buyer JM, grade 11OF, price 212 → Last Bale Details; an invalid grade is rejected but the price still saves", async ({ page }) => {
    await go(page, "/floor/data-capture/e-buying");
    await scan(page, "1000001013");
    await expect(page.getByTestId("bale-info")).toContainText("V100060");
    await expect(page.getByTestId("bale-info")).toContainText("112");

    // partial save first
    await page.getByTestId("f-buyer").fill("jm");
    await page.getByTestId("f-bgrade").fill("zz9");
    await page.getByTestId("f-price").fill("212");
    await page.getByTestId("save-details").click();
    await expect(page.getByText("Invalid Buyer Grade: ZZ9")).toBeVisible();
    await expect(page.getByText("Partly saved")).toBeVisible();

    await page.getByTestId("f-bgrade").fill("11of");
    await page.getByTestId("save-details").click();
    const last = page.getByTestId("last-bale-details");
    await expect(last).toContainText("1000001013");
    await expect(last).toContainText("JM");
    await expect(last).toContainText("11OF");
    await expect(last).toContainText("212");
    // back on the scan screen, ready for the next bale
    await expect(page.getByTestId("scanner-input")).toBeFocused();
  });

  test("classification: invalid TIMB grade is rejected with the documented message", async ({ page }) => {
    await go(page, "/floor/data-capture/classification");
    await scan(page, "1000001013");
    await page.getByTestId("f-timb").fill("zzz");
    await page.getByTestId("save-details").click();
    await expect(page.getByText("Invalid TIMB Grade / Reason: ZZZ")).toBeVisible();
    await page.getByTestId("f-timb").fill("a10");
    await page.getByTestId("save-details").click();
    await expect(page.getByTestId("last-bale-details")).toContainText("A10");
  });

  test("batch processing is blind: captured prices stay hidden until the batch is posted", async ({ page }) => {
    // capture a price on one bale first
    await go(page, "/floor/data-capture/all-details");
    await scan(page, "1000001013");
    await page.getByTestId("f-timb").fill("a10");
    await page.getByTestId("f-buyer").fill("jm");
    await page.getByTestId("f-bgrade").fill("11of");
    await page.getByTestId("f-price").fill("212");
    await page.getByTestId("save-details").click();
    await expect(page.getByTestId("last-bale-details")).toContainText("212");

    await go(page, "/batches/batch-4");
    await expect(page.getByTestId("blind-note")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Captured price" })).toHaveCount(0);

    // posting with a missing price is refused
    await page.getByTestId("batch-price-1000001013").fill("212");
    await page.getByTestId("batch-price-1000001013").press("Enter");
    await page.getByTestId("post-batch").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Post Batch" }).click();
    await expect(page.getByText("Enter a batch price for every purchased ticket before posting (2 missing).")).toBeVisible();

    await page.getByTestId("batch-price-1000001024").fill("198");
    await page.getByTestId("batch-price-1000001024").press("Enter");
    await page.getByTestId("batch-price-1000001035").fill("185");
    await page.getByTestId("batch-price-1000001035").press("Enter");
    await expect(page.getByText("3 of 3 prices")).toBeVisible();
    await page.getByTestId("post-batch").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Post Batch" }).click();
    await expect(page.getByText("Batch has been posted.")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Captured price" })).toBeVisible();
  });
});

test.describe("balancing", () => {
  test("balance the documented sale 4 → 'Sale has balanced!'", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "READY_TO_BALANCE");
    await go(page, "/sales/sale-4");
    await expect(page.getByTestId("balance-preview")).toHaveAttribute("data-can-balance", "true");
    await expect(page.getByTestId("balance-preview")).toContainText("$625.73");
    await page.getByTestId("balance-sale").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Balance Sale" }).click();
    await expect(page.getByText("Sale has balanced!")).toBeVisible();
    await expect(page.getByTestId("sale-status-bar")).toHaveAttribute("data-status", "BALANCED");
    await expect(page.getByTestId("balance-sale")).toBeDisabled();
  });

  test("validation showcase: the preview lists V100061's problems and Balance Sale stays disabled", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "VALIDATION_SHOWCASE");
    await go(page, "/sales/sale-5");
    const preview = page.getByTestId("balance-preview");
    await expect(preview).toHaveAttribute("data-can-balance", "false");
    const issues = page.getByTestId("balance-issues");
    await expect(issues).toContainText("Ticket 1000001046 is missing TIMB grade");
    await expect(issues).toContainText("Invalid Buyer Grade: 11OF");
    await expect(issues).toContainText("Balancing stops on a price mismatch");
    await expect(page.getByTestId("balance-sale")).toBeDisabled();
    // the good sale next door is unaffected
    await go(page, "/sales/sale-4");
    await expect(page.getByTestId("balance-preview")).toHaveAttribute("data-can-balance", "true");
  });

  test("an unposted batch blocks balancing", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "FLOOR_SUMMARY_DONE");
    await go(page, "/sales/sale-4");
    await expect(page.getByTestId("balance-issues")).toContainText("has not been posted");
    await expect(page.getByTestId("balance-sale")).toBeDisabled();
  });
});

test.describe("approvals and roles", () => {
  test("reversal needs a second person: request → cannot self-approve → another approver approves → sale back to Draft", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "data-processing-supervisor");
    await jumpTo(page, "BALANCED");
    await go(page, "/sales/sale-4");
    await page.getByTestId("reverse-sale").click();
    await page.getByTestId("reverse-reason").fill("Buyer grade captured wrongly on ticket 2");
    await page.getByTestId("submit-reversal").click();
    await expect(page.getByText(/Reversal requested — APR-0001 awaits an approver/)).toBeVisible();

    await go(page, "/approvals");
    await page.getByTestId("approvals-table").getByText("APR-0001").click();
    await expect(page.getByTestId("approve-approval")).toBeDisabled();
    await expect(page.getByText("You requested this, so you cannot approve it")).toBeVisible();

    await signInAs(page, "supervisor");
    await go(page, "/approvals");
    await page.getByTestId("approvals-table").getByText("APR-0001").click();
    await page.getByTestId("decision-reason").fill("Agreed");
    await page.getByTestId("approve-approval").click();
    await expect(page.getByText("APR-0001 approved")).toBeVisible();

    await go(page, "/sales/sale-4");
    await expect(page.getByTestId("sale-status-bar")).toHaveAttribute("data-status", "DRAFT");
  });

  test("a Processed sale cannot be reversed here", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "data-processing-supervisor");
    await jumpTo(page, "PROCESSED");
    await go(page, "/sales/sale-4");
    await expect(page.getByTestId("reverse-sale")).toBeDisabled();
  });

  test("roles: floor-summary clerk cannot open sales; accounts can view but not balance; receiving clerk cannot scan", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "floor-summary-clerk");
    await jumpTo(page, "READY_TO_BALANCE");
    await go(page, "/sales/sale-4");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();

    await signInAs(page, "accounts");
    await go(page, "/sales/sale-4");
    await expect(page.getByTestId("balance-sale")).toBeDisabled();

    await signInAs(page, "receiving-clerk");
    await go(page, "/floor/floor-summary");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });

  test("a floor-summary clerk (scan only) has no toggle permission", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "floor-summary-clerk");
    await jumpTo(page, "TICKETS_CONFIRMED");
    await openScanScreen(page);
    await expect(page.getByTestId("toggle-scanning")).toBeDisabled();
  });
});
