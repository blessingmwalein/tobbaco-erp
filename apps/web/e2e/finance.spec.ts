import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { go, jumpTo, resetDemo, signInAs } from "./helpers";

/** Simulate what the stop-order importer (TIMB data → Imports) would have created, then persist it for reloads. */
async function injectStopOrder(page: Page, opts: { fileDate?: string; file?: string } = {}) {
  await page.waitForFunction(() => Boolean((window as unknown as { __demo?: unknown }).__demo));
  await page.evaluate((o) => {
    const db = (window as unknown as { __demo: { getDb: () => { stopOrders: unknown[] } } }).__demo.getDb();
    db.stopOrders.push({
      id: "stoporder-1",
      timbFile: o.file ?? "EL_stoporders_20260917.txt",
      fileDate: o.fileDate ?? "2026-09-17",
      growerNo: "V100060",
      creditorCode: "00050",
      amount1Cents: 5000,
      amount2Cents: 0,
      amount3Cents: 0,
      paidAmountCents: 0,
      priority: 1,
      recType: "06",
      stopOrderNo: 1,
      percent: 0,
      season: 2026,
      createdAt: "2026-09-17T12:30:03",
    });
    localStorage.setItem("tobacco-erp-mock-db", JSON.stringify(db));
  }, opts);
}

async function injectApproval(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { __demo?: unknown }).__demo));
  await page.evaluate(() => {
    const db = (window as unknown as { __demo: { getDb: () => { approvals: unknown[] } } }).__demo.getDb();
    db.approvals.push({ id: "apr-1", ref: "APR-0001", entityType: "Sale", entityId: "sale-4", entityRef: "Salesmaster 4", action: "sale.reverse", requestedBy: "user-supervisor", requestReason: "e2e", requestedAt: "2026-09-17T12:20:00", status: "PENDING" });
    localStorage.setItem("tobacco-erp-mock-db", JSON.stringify(db));
  });
}

test.describe("stop order processing (Manual 07)", () => {
  test("BALANCED → preview, advisory checklist, processes without the $50 stop order", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "BALANCED");
    await go(page, "/finance/stop-order-processing");

    await expect(page.getByTestId("deduction-order")).toContainText("Statutory & floor charges");
    await expect(page.getByTestId("deduction-order").locator("li")).toHaveCount(5);
    await expect(page.getByTestId("processing-checklist").locator('[data-state="advisory"]')).toContainText("Stop order file not imported");
    await expect(page.getByTestId("plan-sale-4")).toBeVisible();
    await expect(page.getByTestId("plan-sale-5")).toBeVisible();

    await page.getByTestId("run-processing").click();
    await page.getByRole("button", { name: "Process sales" }).click();
    await expect(page.getByTestId("processing-result")).toContainText("Pay batch 1001");
    const v60 = page.getByTestId("result-sale-4");
    await expect(v60.getByTestId("deduction-line")).toHaveCount(5); // 5 floor charges, no stop order
    await expect(v60.getByTestId("net-payout")).toHaveText("$549.43");
    await expect(page.getByTestId("result-sale-5").getByTestId("net-payout")).toHaveText("$342.64");
  });

  test("with the stop order imported: 6 lines in documented order, net $499.43", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "BALANCED");
    await injectStopOrder(page);
    await go(page, "/finance/stop-order-processing");
    await expect(page.getByTestId("processing-checklist").locator('[data-state="advisory"]')).toHaveCount(0);

    await page.getByTestId("run-processing").click();
    await page.getByRole("button", { name: "Process sales" }).click();
    const v60 = page.getByTestId("result-sale-4");
    await expect(v60.getByTestId("deduction-line")).toHaveCount(6);
    await expect(v60.getByTestId("deduction-line").last()).toHaveAttribute("data-sequence", "5");
    await expect(v60.getByTestId("net-payout")).toHaveText("$499.43");

    // Processed for real: the sale list state and the wizard now say nothing is left to process.
    await go(page, "/finance/stop-order-processing");
    await expect(page.getByText("There are no Balanced sales to process")).toBeVisible();
    await expect(page.getByTestId("run-processing")).toBeDisabled();
  });

  test("a stop order file dated for another day is NOT deducted (STOP_NOT_DEDUCTED)", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "BALANCED");
    await injectStopOrder(page, { fileDate: "2026-09-16", file: "EL_stoporders_20260916.txt" });
    await go(page, "/finance/stop-order-processing");
    await expect(page.getByText("Stop order not deducted").first()).toBeVisible();
    await page.getByTestId("run-processing").click();
    await page.getByRole("button", { name: "Process sales" }).click();
    await expect(page.getByTestId("result-sale-4").getByTestId("deduction-line")).toHaveCount(5);
  });

  test("pending approvals block processing", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "BALANCED");
    await injectApproval(page);
    await go(page, "/finance/stop-order-processing");
    await expect(page.getByTestId("processing-checklist")).toContainText("There are :: 1 :: Pending Approvals");
    await expect(page.getByTestId("run-processing")).toBeDisabled();
  });

  test("roles: data clerk has no access; accounts can view but not process; supervisor can process", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "data-clerk");
    await jumpTo(page, "BALANCED");
    await go(page, "/finance/stop-order-processing");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();

    await page.evaluate(() => localStorage.setItem("tobacco-erp-session", JSON.stringify({ state: { userId: "user-accounts" }, version: 0 })));
    await go(page, "/finance/stop-order-processing");
    await expect(page.getByTestId("run-processing")).toBeDisabled();

    await page.evaluate(() => localStorage.setItem("tobacco-erp-session", JSON.stringify({ state: { userId: "user-data-processing-supervisor" }, version: 0 })));
    await go(page, "/finance/stop-order-processing");
    await expect(page.getByTestId("run-processing")).toBeEnabled();
  });
});

test.describe("deductions dashboard", () => {
  test("reconciles to $173.11 · 11 lines · 2 growers · 6 creditors and opens a creditor", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await jumpTo(page, "PROCESSED");
    await go(page, "/finance/deductions");
    await expect(page.getByRole("heading", { name: "Deductions Dashboard" })).toBeVisible();
    await expect(page.getByTestId("tile-total")).toContainText("$173.11");
    await expect(page.getByTestId("tile-lines")).toContainText("11");
    await expect(page.getByTestId("tile-growers")).toContainText("2");
    await expect(page.getByTestId("tile-creditors")).toContainText("6");
    await expect(page.getByTestId("by-currency")).toContainText("$173.11");
    await expect(page.getByTestId("by-source")).toContainText("Internal USD invoices");
    await expect(page.getByTestId("by-source")).toContainText("$123.11");
    await expect(page.getByTestId("by-source")).toContainText("TIMB USD Stop Orders");
    await expect(page.getByTestId("by-source")).toContainText("$50.00");

    await page.getByTestId("creditor-00050").click();
    await expect(page.getByTestId("deductions-table").locator("tbody tr")).toHaveCount(1);
    await expect(page.getByTestId("deductions-table")).toContainText("Creditor 00050");
    await page.getByRole("button", { name: "Clear creditor filter" }).click();
    await expect(page.getByTestId("deductions-table").locator("tbody tr")).toHaveCount(10); // first page of 11
  });

  test("empty range shows an empty state, not zeros", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await go(page, "/finance/deductions");
    await expect(page.getByText(/No deductions between/)).toBeVisible();
  });
});

test.describe("grower payments (Manual 08)", () => {
  test("generate USD schedule → CSV (13 columns) does not mark paid → record verified confirmations → Paid", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await jumpTo(page, "PROCESSED");
    await go(page, "/finance/payments");

    await page.getByTestId("open-generate-schedule").click();
    await page.getByLabel(/Batch #/).fill("1001");
    await page.getByTestId("generate-schedule").click();
    await expect(page.getByTestId("schedule-result")).toContainText("PSCH-1001-USD");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-csv-dialog").click()]);
    expect(download.suggestedFilename()).toBe("payment_schedule_1001_USD.csv");
    const csv = fs.readFileSync((await download.path())!, "utf8").split(/\r?\n/);
    expect(csv[0]!.split(",")).toEqual([
      "Transaction_Type", "Beneficiary", "Currency", "Credit_Account", "transaction_date", "Amount", "Debit_Account",
      "Company_Name", "Batch_Reference", "Transaction_Id", "Bank_Code", "Bank", "Branch_Code",
    ]);
    expect(csv[1]).toContain("499.43");
    await page.keyboard.press("Escape");

    await go(page, "/finance/payments/1001");
    const lines = page.getByTestId("lines-USD");
    await expect(lines).toContainText("V100060");
    await expect(lines).toContainText("V100061");
    // Downloading the CSV did NOT mark anyone paid.
    await expect(page.getByTestId("line-status-V100060")).toHaveAttribute("data-status", "PENDING");
    await expect(page.getByTestId("line-status-V100061")).toHaveAttribute("data-status", "PENDING");
    await expect(page.getByTestId("csv-preview-USD").locator("thead th")).toHaveCount(13);

    // Wrong amount is rejected; the exact amount with a reference confirms.
    await page.getByTestId("confirm-line-V100060").click();
    await page.getByLabel(/Confirmation reference/).fill("BANK-REF-1");
    await page.getByLabel(/Confirmed amount/).fill("499.42");
    await page.getByTestId("submit-confirmation").click();
    await expect(page.getByText(/does not match the scheduled amount 499.43/)).toBeVisible();
    await page.getByLabel(/Confirmed amount/).fill("499.43");
    await page.getByTestId("submit-confirmation").click();
    await expect(page.getByTestId("line-status-V100060")).toHaveAttribute("data-status", "PAID");
    await expect(page.getByTestId("line-status-V100061")).toHaveAttribute("data-status", "PENDING");

    await page.getByTestId("confirm-line-V100061").click();
    await page.getByLabel(/Confirmation reference/).fill("BANK-REF-2");
    await page.getByLabel(/Confirmed amount/).fill("342.64");
    await page.getByTestId("submit-confirmation").click();
    await expect(page.getByTestId("line-status-V100061")).toHaveAttribute("data-status", "PAID");
    await expect(page.getByTestId("recon-USD")).toContainText("$842.07");
    await expect(page.getByTestId("payment-history")).toContainText("Bank confirmation recorded");
    await expect(page.getByTestId("payment-history")).toContainText("CSV downloaded (no status change)");
  });

  test("ZWL schedule leaves out V100061 (no ZWL account); duplicate USD schedule is refused", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await jumpTo(page, "PROCESSED");
    await go(page, "/finance/payments");

    await page.getByTestId("open-generate-schedule").click();
    await page.getByLabel(/Currency/).selectOption("ZWL");
    await page.getByTestId("generate-schedule").click();
    await expect(page.getByTestId("schedule-result")).toContainText("PSCH-1001-ZWL");
    await expect(page.getByText(/Left out: .*V100061 \(No ZWL bank account on file\)/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("excluded-growers")).toContainText("V100061");

    await page.getByTestId("open-generate-schedule").click();
    await page.getByLabel(/Batch #/).fill("1001");
    await page.getByLabel(/Currency/).selectOption("USD");
    await page.getByTestId("generate-schedule").click();
    await page.getByLabel(/Batch #/).fill("1001");
    await page.getByTestId("generate-schedule").click(); // second time → duplicate
    await expect(page.getByText(/already exists \(PSCH-1001-USD\)/).first()).toBeVisible();
  });

  test("CloudPay is a mock: submits but never marks paid", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await jumpTo(page, "PROCESSED");
    await go(page, "/finance/payments/1001");
    await page.getByTestId("batch-generate").click();
    await page.getByTestId("generate-schedule").click();
    await expect(page.getByTestId("schedule-result")).toContainText("PSCH-1001-USD");
    await page.keyboard.press("Escape");

    await page.getByTestId("cloudpay-USD").click();
    await page.getByRole("button", { name: "Submit (mock)" }).click();
    await expect(page.getByTestId("line-status-V100060")).toHaveAttribute("data-status", "SUBMITTED");
    await expect(page.getByTestId("line-status-V100061")).toHaveAttribute("data-status", "SUBMITTED");
    await expect(page.getByTestId("payment-history")).toContainText("MOCK — no payment instruction was sent");
    await expect(page.locator('[data-status="PAID"]')).toHaveCount(0);
  });

  test("a failed line can be recorded and nothing is deleted from the history", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await jumpTo(page, "PROCESSED");
    await go(page, "/finance/payments/1001");
    await page.getByTestId("batch-generate").click();
    await page.getByTestId("generate-schedule").click();
    await page.keyboard.press("Escape");
    await page.getByTestId("fail-line-V100061").click();
    await page.getByLabel(/Reason/).fill("Account closed");
    await page.getByTestId("submit-failure").click();
    await expect(page.getByTestId("line-status-V100061")).toHaveAttribute("data-status", "FAILED");
    await expect(page.getByTestId("payment-history")).toContainText("Account closed");
    await expect(page.getByTestId("payment-history")).toContainText("Schedule generated");
  });

  test("roles: supervisor can view payments but not generate; clerks have no access", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "data-processing-supervisor");
    await jumpTo(page, "PROCESSED");
    await go(page, "/finance/payments");
    await expect(page.getByTestId("open-generate-schedule")).toBeDisabled();

    await page.evaluate(() => localStorage.setItem("tobacco-erp-session", JSON.stringify({ state: { userId: "user-receiving-clerk" }, version: 0 })));
    await go(page, "/finance/payments");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();

    await page.evaluate(() => localStorage.setItem("tobacco-erp-session", JSON.stringify({ state: { userId: "user-accounts" }, version: 0 })));
    await go(page, "/finance/payments");
    await expect(page.getByTestId("open-generate-schedule")).toBeEnabled();
  });
});

test.describe("sales sheets", () => {
  test("Get Report renders one reconciled sheet per grower", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await jumpTo(page, "PROCESSED");
    await go(page, "/finance/sales-sheets");
    await expect(page.getByText("No report yet")).toBeVisible();
    await page.getByTestId("get-report").click();
    const sheets = page.getByTestId("sales-sheet");
    await expect(sheets).toHaveCount(2);
    const v60 = page.locator('[data-testid="sales-sheet"][data-grower="V100060"]');
    await expect(v60).toContainText("1000001013");
    await expect(v60.getByTestId("sheet-gross")).toHaveText("$625.73");
    await expect(v60.getByTestId("sheet-net")).toHaveText("$499.43");
    await expect(v60.getByTestId("sheet-payment-status")).toHaveText("No payment schedule yet");

    await page.getByLabel("REF#").fill("5");
    await page.getByTestId("get-report").click();
    await expect(sheets).toHaveCount(1);
  });
});
