import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pickDateRange } from "./dates";
import { ACCOUNTS, signInBuyer } from "./helpers";

/**
 * Needs the deterministic scenario: `ALLOW_DB_RESET=yes DATABASE_URL=<disposable db> pnpm --filter @tobacco/api e2e:scenario`
 * (3 purchases, 3 shipments — one in transit —, 8 bales on hand …; see apps/api/test/scenario.ts).
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId("report-filters")).toBeVisible();
  await expect(page.getByText("Could not load this report")).toHaveCount(0);
}

test.describe("Buyer reports (real API + database)", () => {
  test("Purchase Reports load with figures — not 'Cannot GET'", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await open(page, "/buyer/reports/purchases");
    await expect(page.getByTestId("report-row")).toHaveCount(3);
    await expect(page.getByTestId("report-row-count")).toContainText("Showing 1–3 of 3 rows");
    await expect(page.getByTestId("report-totals")).toContainText("Total · all 3 rows");
    await expect(page.getByTestId("report-tiles")).toContainText("US$ 1,631.50"); // payable
    const a = page.getByTestId("report-row").filter({ hasText: "INV-A-001" });
    await expect(a).toContainText("22 May 2026");
    await expect(a).toContainText("2,320.00");
    await expect(a).toContainText("Partially received"); // a status badge, not a raw code
  });

  test("Receiving Reports compare purchase, shipment and received with the differences", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await open(page, "/buyer/reports/receiving");
    await expect(page.getByTestId("report-tab-purchase-shipment-received")).toHaveAttribute("aria-current", "page");
    const a = page.getByTestId("report-row").filter({ hasText: "22 May 2026" });
    await expect(a).toContainText("960.0"); // purchased kg
    await expect(a).toContainText("880.0"); // dispatched kg
    await expect(a).toContainText("4 / 6"); // weighed of received
    await expect(page.getByTestId("report-tiles")).toContainText("Outstanding bales");
    await expect(page.getByTestId("report-tile").filter({ hasText: "Outstanding bales" })).toContainText("3");
    // "only with differences" hides the purchase that matches exactly (the April one)
    await page.getByTestId("report-only-variances").click();
    await expect(page).toHaveURL(/diff=1/);
    await expect(page.getByTestId("report-row")).toHaveCount(2);
    await expect(page.getByTestId("report-row").filter({ hasText: "1 Apr 2026" })).toHaveCount(0);
  });

  test("Inventory Reports: tabs, a real date-range picker, and the filters live in the URL", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await open(page, "/buyer/reports/inventory");
    await page.getByTestId("report-tab-warehouse-movements").click();
    await expect(page).toHaveURL(/report=warehouse-movements/);
    await expect(page.getByTestId("report-row")).toHaveCount(8);

    await pickDateRange(page, "Moved on", "2026-05-01", "2026-05-31");
    await expect(page).toHaveURL(/from=2026-05-01/);
    await expect(page).toHaveURL(/to=2026-05-31/);
    await expect(page.getByTestId("report-row")).toHaveCount(6); // the six May movements; April's two are filtered out
    await expect(page.getByRole("button", { name: /^Moved on:/ })).toContainText("1 May 2026 – 31 May 2026");

    await page.reload(); // deep link: the same view comes back
    await expect(page.getByTestId("report-row")).toHaveCount(6);
    await expect(page.getByRole("button", { name: /^Moved on:/ })).toContainText("1 May 2026 – 31 May 2026");
    // no native browser date inputs anywhere
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    await page.getByTestId("report-clear-filters").click();
    await expect(page.getByTestId("report-row")).toHaveCount(8);
    await expect(page).not.toHaveURL(/from=/);
  });

  test("search finds a barcode that ends in a blank, and shows the blank", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await open(page, `/buyer/reports/inventory?report=inventory-position&q=${encodeURIComponent("111000003 ")}`);
    await expect(page.getByTestId("report-row")).toHaveCount(1);
    await expect(page.getByTitle("blank check character")).toBeVisible();
  });

  test("typing in the search box filters after a pause and updates the URL", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await open(page, "/buyer/reports/purchases");
    await page.getByTestId("report-search").fill("INV-A");
    await expect(page).toHaveURL(/q=INV-A/);
    await expect(page.getByTestId("report-row")).toHaveCount(1);
  });

  test("sorting is server-side and reflected in the URL and aria-sort", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await open(page, "/buyer/reports/inventory?report=inventory-position");
    await page.getByRole("button", { name: "Sort by Mass (kg)" }).click();
    await expect(page).toHaveURL(/sort=massKg&dir=asc/);
    await expect(page.getByRole("columnheader", { name: /Mass \(kg\)/ })).toHaveAttribute("aria-sort", "ascending");
    await page.getByRole("button", { name: "Sort by Mass (kg)" }).click();
    await expect(page).toHaveURL(/dir=desc/);
  });

  test("an empty result explains itself and offers to clear the filters", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await open(page, "/buyer/reports/purchases?floor=zzzz");
    await expect(page.getByText("No rows match these filters")).toBeVisible();
    await expect(page.getByTestId("report-export-csv")).toBeDisabled(); // nothing to export
    await page.getByRole("button", { name: "Clear filters" }).last().click();
    await expect(page.getByTestId("report-row")).toHaveCount(3);
  });

  test("exports download a real PDF, Excel workbook and CSV (all rows, not just the page)", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await open(page, "/buyer/reports/inventory?report=inventory-position&size=25");

    const csv = await Promise.all([page.waitForEvent("download"), page.getByTestId("report-export-csv").click()]).then(([d]) => d);
    expect(csv.suggestedFilename()).toMatch(/^inventory-position_\d{4}-\d{2}-\d{2}\.csv$/);
    const csvText = readFileSync((await csv.path())!, "utf8");
    expect(csvText.charCodeAt(0)).toBe(0xfeff);
    expect(csvText.trimEnd().split("\r\n")).toHaveLength(1 + 8 + 1); // header + 8 bales on hand + totals

    const xlsx = await Promise.all([page.waitForEvent("download"), page.getByTestId("report-export-xlsx").click()]).then(([d]) => d);
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
    expect(readFileSync((await xlsx.path())!).subarray(0, 2).toString()).toBe("PK"); // a zip container

    const pdf = await Promise.all([page.waitForEvent("download"), page.getByTestId("report-export-pdf").click()]).then(([d]) => d);
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
    const bytes = readFileSync((await pdf.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(3000);
    await expect(page.getByText(/downloaded/).first()).toBeVisible(); // success toast
  });

  test("a Viewer can read but not export, and sees only the reports their role allows", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.viewer);
    await open(page, "/buyer/reports/purchases");
    await expect(page.getByTestId("report-tab-purchase-register")).toBeVisible();
    await expect(page.getByTestId("report-tab-invoice-charges")).toHaveCount(0); // needs the invoices permission
    await expect(page.getByTestId("report-export-pdf")).toBeDisabled();
    await expect(page.getByTestId("report-export-xlsx")).toBeDisabled();
    await expect(page.getByTestId("report-export-csv")).toBeDisabled();
  });

  test("Finance sees purchase and receiving reports but not warehouse stock", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.finance);
    await open(page, "/buyer/reports/purchases");
    await expect(page.getByTestId("report-tab-invoice-charges")).toBeVisible();
    await page.goto("/buyer/reports/inventory");
    await expect(page.getByText("No reports available for your role")).toBeVisible();
  });

  test("no serious accessibility violations on the report pages", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    const problems: string[] = [];
    for (const path of ["/buyer/reports/purchases", "/buyer/reports/receiving", "/buyer/reports/inventory?report=inventory-position"]) {
      await open(page, path);
      await expect(page.getByTestId("report-table")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of results.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
        problems.push(`${path}: [${v.impact}] ${v.id} — ${v.help} e.g. ${v.nodes[0]?.target.join(" ")}`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
