import { expect, test } from "@playwright/test";
import { jumpTo, resetDemo, signInAs, go } from "./helpers";

test.describe("shell, login and daily setup", () => {
  test("login → dashboard shows blocked daily setup on a fresh morning", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Sale day dashboard" })).toBeVisible();
    await expect(page.getByTestId("stage-pipeline")).toBeVisible();
    await expect(page.getByText("Sale date", { exact: true }).first()).toBeVisible();
  });

  test("daily setup: create sale date then post Start of Day", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");

    await go(page, "/setup/sale-dates");
    await page.getByTestId("new-sale-date").click();
    await page.getByRole("button", { name: "Save sale date" }).click();
    await expect(page.getByText("Sale date 2026-09-17 created and activated")).toBeVisible();
    await expect(page.getByTestId("sale-dates-table").getByText("17 September 2026")).toBeVisible();

    await go(page, "/setup/start-of-day");
    await page.getByTestId("post-sod").click(); // empty rate → required
    await expect(page.getByText("Exchange rate is required")).toBeVisible();
    await page.getByLabel(/Exchange rate/).fill("0");
    await page.getByTestId("post-sod").click(); // zero → the documented message
    await expect(page.getByText("Exchange Rate should be bigger than ZERO!").first()).toBeVisible();
    await page.getByLabel(/Exchange rate/).fill("26.6845");
    await page.getByTestId("post-sod").click();
    await page.getByRole("button", { name: "Post Start of Day" }).last().click();
    await expect(page.getByText("Start of Day Completed Successfully.")).toBeVisible();
    await expect(page.getByTestId("sod-table").getByText("26.68450000").first()).toBeVisible();
  });

  test("role permissions: a receiving clerk cannot post Start of Day", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "receiving-clerk");
    await go(page, "/setup/start-of-day");
    await expect(page.getByTestId("post-sod")).toBeDisabled();
  });

  test("scenario preset: processed day shows stages complete", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "PROCESSED");
    await go(page, "/sale-day");
    await expect(page.locator('[data-stage="BALANCING"]')).toHaveAttribute("data-status", "COMPLETE");
    await expect(page.locator('[data-stage="STOP_ORDERS"]')).toHaveAttribute("data-status", "COMPLETE");
  });
});
