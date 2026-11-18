import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { pickDateRange } from "./dates";
import { ACCOUNTS, signInBuyer } from "./helpers";

/** Needs the deterministic scenario (see reports.spec.ts). */
test.describe("Buyer dashboard (real API + database)", () => {
  test("shows the correct totals, the dates they cover and the shipment pipeline", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await expect(page.getByTestId("dashboard-kpis")).toBeVisible();
    await expect(page.getByTestId("kpi-purchases")).toContainText("3");
    await expect(page.getByTestId("kpi-purchases")).toContainText("1 Apr 2026 – 10 Jun 2026"); // the dates the purchases cover
    await expect(page.getByTestId("kpi-bought")).toContainText("17 bales");
    await expect(page.getByTestId("kpi-received")).toContainText("8 of 17");
    await expect(page.getByTestId("kpi-received")).toContainText("9 still to receive");
    await expect(page.getByTestId("kpi-stock")).toContainText("7 bales"); // in a warehouse location now
    await expect(page.getByTestId("kpi-stock")).toContainText("1 received, not yet stored");
    await expect(page.getByTestId("kpi-payable-usd")).toContainText("US$ 1,631.50");
    await expect(page.getByTestId("kpi-exceptions")).toContainText("1");

    // shipments: one on the road, none waiting at the gate or being received
    await expect(page.getByTestId("stage-in-transit-count")).toHaveText("1");
    await expect(page.getByTestId("stage-arrived-count")).toHaveText("0");
    await expect(page.getByTestId("stage-receiving-count")).toHaveText("0");
    await expect(page.getByTestId("stage-awaiting-storage-count")).toHaveText("0");
    const road = page.getByTestId("list-in-transit");
    await expect(road).toContainText("ABC 1234 / TRL 1");
    await expect(road).toContainText("0 / 3 bales");
    await expect(page.getByTestId("stage-completed")).toContainText("2 shipments · 8 bales in total");
  });

  test("the date range picks purchases by sale date, while the live shipment position stays put", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await expect(page.getByTestId("kpi-purchases")).toContainText("3");
    await pickDateRange(page, "Sale dates", "2026-05-01", "2026-05-31");
    await expect(page.getByTestId("kpi-purchases")).toContainText("22 May 2026");
    await expect(page.getByTestId("kpi-bought")).toContainText("10 bales");
    await expect(page.getByTestId("kpi-received")).toContainText("6 of 10");
    await expect(page.getByTestId("stage-in-transit-count")).toHaveText("1"); // live: unaffected by the dates
    await expect(page.getByTestId("kpi-stock")).toContainText("7 bales");
    await expect(page.getByTestId("stage-completed")).toContainText("1 shipment · 6 bales in the selected dates");
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
  });

  test("the in-transit tile opens the shipments page already filtered", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await page.getByTestId("stage-in-transit").click();
    await expect(page).toHaveURL(/\/buyer\/shipments\?status=IN_TRANSIT/);
    await expect(page.getByText(/SHP-A2/).first()).toBeVisible();
    await expect(page.getByText(/SHP-A1/)).toHaveCount(0); // the received shipment is filtered out
  });

  test("works on a phone: no sideways scroll, pipeline still readable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInBuyer(page, ACCOUNTS.admin);
    await expect(page.getByTestId("dashboard-shipments")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("no serious accessibility violations", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await expect(page.getByTestId("dashboard-shipments")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = results.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.help} e.g. ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
});
