import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { go, resetDemo, signInAs } from "./helpers";

async function pickSample(page: Page, type: string, sampleKey: string) {
  await go(page, `/timb/imports/new?type=${type}`);
  await page.getByTestId(`sample-${sampleKey}`).click();
  await expect(page.getByTestId("validation-checks")).toBeVisible();
}

test.describe("TIMB imports", () => {
  test("booking import: sample → validate → preview → confirm → result, then idempotent re-import", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "timb-clerk");

    await pickSample(page, "GROWER_BOOKING", "booking-0917");
    await expect(page.getByText("File accepted")).toBeVisible();
    await page.getByTestId("validate-continue").click();
    // Preview: 2 rows, 2 will create, 0 errors.
    await expect(page.getByTestId("count-will-create")).toContainText("2");
    await expect(page.getByTestId("count-rows-with-errors")).toContainText("0");
    await page.getByTestId("import-confirm-open").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Import records" }).click();
    await expect(page.getByTestId("import-result-message")).toHaveText("Grower Booking Import complete: 2 created, 0 updated, 0 errors.");

    // The bookings list shows the two documented bookings.
    await page.getByTestId("view-results").click();
    await expect(page.getByTestId("bookings-table")).toBeVisible();
    await expect(page.getByTestId("bookings-table").getByText("EL2609170001")).toBeVisible();
    await expect(page.getByTestId("bookings-table").getByText("EL2609170002")).toBeVisible();

    // Same file again: matched on the booking reference → updated, not duplicated.
    await pickSample(page, "GROWER_BOOKING", "booking-0917");
    await page.getByTestId("validate-continue").click();
    await expect(page.getByText("This exact file was already imported")).toBeVisible();
    await page.getByTestId("import-confirm-open").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Import records" }).click();
    await expect(page.getByTestId("import-result-message")).toHaveText("Grower Booking Import complete: 0 created, 2 updated, 0 errors.");

    await go(page, "/timb/bookings?q=EL26091700");
    await expect(page.getByTestId("bookings-table").getByText("EL2609170001")).toHaveCount(1);
  });

  test("renamed file is refused with the decryption-key message and can be recorded as Failed", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "timb-clerk");
    await pickSample(page, "GROWER_BOOKING", "booking-renamed");
    await expect(page.getByTestId("validation-error")).toHaveText("Booking Decryption Keys for boo is missing. Check filename of file");
    await expect(page.getByTestId("validate-continue")).toBeDisabled();

    await page.getByTestId("record-failed").click();
    await expect(page.getByTestId("import-result-message")).toHaveText("Booking Decryption Keys for boo is missing. Check filename of file");
    await go(page, "/timb/imports");
    await expect(page.getByTestId("imports-table").locator('[data-status="FAILED"]').first()).toBeVisible();
  });

  test("a file with bad rows completes with errors and offers a downloadable error report", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "timb-clerk");
    await pickSample(page, "GROWER_BOOKING", "booking-0918-errors");
    await page.getByTestId("validate-continue").click();
    await expect(page.getByTestId("count-rows-with-errors")).toContainText("2");
    await expect(page.getByTestId("row-errors")).toContainText("V999999");
    await page.getByTestId("import-confirm-open").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Import records" }).click();
    await expect(page.getByTestId("import-result-message")).toHaveText("Grower Booking Import complete: 1 created, 0 updated, 2 errors.");
    await expect(page.getByText("Import complete with errors")).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-errors").click()]);
    expect(download.suggestedFilename()).toMatch(/^IMP-\d{4}_errors\.csv$/);
    const text = fs.readFileSync((await download.path())!, "utf8");
    expect(text).toContain("V999999");
    expect(text).toContain("bales_booked");
  });

  test("stop order import (Manual 07) creates the $50.00 order for V100060 / creditor 00050", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "data-processing-supervisor");
    await pickSample(page, "STOP_ORDER", "stoporders-0917");
    await page.getByTestId("validate-continue").click();
    await expect(page.getByText("Linked to the sales of 2026-09-17")).toBeVisible();
    await page.getByTestId("import-confirm-open").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Import records" }).click();
    await expect(page.getByTestId("import-result-message")).toHaveText("Stop Order import complete — 1 created, 0 updated, 0 errors.");

    await go(page, "/creditors");
    await page.getByTestId("creditors-table").getByText("00050", { exact: true }).click();
    const sheet = page.getByTestId("creditor-sheet");
    await expect(sheet).toContainText("$50.00");
    await expect(sheet).toContainText("V100060");
  });

  test("import history lists attempts and opens the job detail", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "timb-clerk");
    await go(page, "/timb/imports");
    await expect(page.getByTestId("imports-table")).toContainText("ELS_ETHICAL_20260911.txt");
    await page.getByTestId("imports-table").getByText("IMP-0001").click();
    await expect(page.getByTestId("job-result-message")).toHaveText("Grower Booking Import complete: 8 created, 0 updated, 0 errors.");
  });
});

test.describe("roles and permissions", () => {
  test("a data processing supervisor cannot import bookings (button disabled at the preview step)", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "data-processing-supervisor");
    await pickSample(page, "GROWER_BOOKING", "booking-0917");
    await page.getByTestId("validate-continue").click();
    await expect(page.getByTestId("import-confirm-open")).toBeDisabled();
  });

  test("a receiving clerk has no access to TIMB data", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "receiving-clerk");
    await go(page, "/timb/imports");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });
});

test.describe("registers", () => {
  test("accounts can add a grower bank account; the receiving supervisor cannot", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await go(page, "/growers/V100074");
    await page.getByTestId("tab-bank").click();
    await expect(page.getByText("No bank details")).toBeVisible();
    await page.getByTestId("add-bank-account").click();
    await page.getByLabel(/Bank name/).fill("Demo Bank A");
    await page.getByLabel(/Bank code/).fill("DBA");
    await page.getByLabel(/Branch code/).fill("002");
    await page.getByLabel(/Account number/).fill("4100074001");
    await page.getByLabel(/Account name/).fill("Farai Ngapasare");
    await page.getByTestId("save-bank-account").click();
    await expect(page.getByText("Bank account added")).toBeVisible();
    await expect(page.getByRole("table", { name: "Bank accounts" })).toContainText("4100074001");

    // Validation: account number too short.
    await page.getByTestId("add-bank-account").click();
    await page.getByLabel(/Bank name/).fill("Demo Bank B");
    await page.getByLabel(/Bank code/).fill("DBB");
    await page.getByLabel(/Branch code/).fill("014");
    await page.getByLabel(/Account number/).fill("1");
    await page.getByLabel(/Account name/).fill("Farai Ngapasare");
    await page.getByTestId("save-bank-account").click();
    await expect(page.getByText("Account number must be 4–24 letters, digits or dashes")).toBeVisible();

    await signInAs(page, "receiving-supervisor", "/login");
    await go(page, "/growers/V100074");
    await page.getByTestId("tab-bank").click();
    await expect(page.getByTestId("add-bank-account")).toBeDisabled();
  });

  test("growers register: search and open a grower", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "supervisor");
    await go(page, "/growers");
    await page.getByLabel("Search grower no. or name").fill("Chengetai");
    await expect(page.getByTestId("growers-table")).toContainText("V100060");
    await expect(page.getByTestId("growers-table")).toContainText("V100079");
    await page.getByTestId("growers-table").getByText("V100060").first().click();
    await expect(page.getByRole("heading", { name: /Chengetai Chingoma/ })).toBeVisible();
  });

  test("system administrator edits a buyer's grades; accounts cannot", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "system-admin");
    await go(page, "/buyers");
    await page.getByTestId("edit-buyer-JM").click();
    await page.getByLabel("Buyer grades").fill("11OF, 12OF, 14of");
    await page.getByTestId("save-buyer").click();
    await expect(page.getByText("Buyer JM saved")).toBeVisible();
    await expect(page.getByTestId("buyers-table")).toContainText("14OF");

    await signInAs(page, "accounts", "/login");
    await go(page, "/buyers");
    await expect(page.getByTestId("add-buyer")).toBeDisabled();
  });
});
