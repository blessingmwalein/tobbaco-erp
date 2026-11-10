import { expect } from "@playwright/test";
import type { Screen } from "./types";

export const SCREENS: Screen[] = [
  {
    id: "70-stop-order-processing-preview",
    path: "/finance/stop-order-processing",
    role: "data-processing-supervisor",
    scenario: "BALANCED",
    tall: true,
    waitFor: '[data-testid="plan-sale-4"]',
  },
  {
    id: "71-stop-order-processing-result",
    path: "/finance/stop-order-processing",
    role: "data-processing-supervisor",
    scenario: "BALANCED",
    tall: true,
    waitFor: '[data-testid="plan-sale-4"]',
    before: async (page) => {
      await page.getByTestId("run-processing").click();
      await page.getByRole("button", { name: "Process sales" }).click();
      await expect(page.getByTestId("processing-result")).toBeVisible();
    },
  },
  { id: "72-stop-orders", path: "/finance/stop-orders", role: "accounts", scenario: "PROCESSED" },
  { id: "73-deductions-dashboard", path: "/finance/deductions", role: "accounts", scenario: "PROCESSED", tall: true, waitFor: '[data-testid="tile-total"]' },
  { id: "74-grower-charges", path: "/finance/grower-charges", role: "accounts", scenario: "PROCESSED" },
  {
    id: "75-sales-sheet",
    path: "/finance/sales-sheets",
    role: "accounts",
    scenario: "PROCESSED",
    tall: true,
    before: async (page) => {
      await page.getByTestId("get-report").click();
      await expect(page.getByTestId("sales-sheet").first()).toBeVisible();
    },
  },
  { id: "76-payments", path: "/finance/payments", role: "accounts", scenario: "PROCESSED", tall: true },
  {
    id: "77-payments-generate-dialog",
    path: "/finance/payments",
    role: "accounts",
    scenario: "PROCESSED",
    before: async (page) => {
      await page.getByTestId("open-generate-schedule").click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    id: "78-pay-batch-detail",
    path: "/finance/payments/1001",
    role: "accounts",
    scenario: "PROCESSED",
    tall: true,
    before: async (page) => {
      await page.getByTestId("batch-generate").click();
      await page.getByTestId("generate-schedule").click();
      await expect(page.getByTestId("schedule-result")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByTestId("confirm-line-V100060").click();
      await page.getByLabel(/Confirmation reference/).fill("BANK-REF-1");
      await page.getByLabel(/Confirmed amount/).fill("499.43");
      await page.getByTestId("submit-confirmation").click();
      await expect(page.getByTestId("line-status-V100060")).toHaveAttribute("data-status", "PAID");
    },
  },
];
