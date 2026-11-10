import { expect } from "@playwright/test";
import type { Screen } from "./types";

export const SCREENS: Screen[] = [
  { id: "10-timb-imports-history", path: "/timb/imports", role: "timb-clerk", scenario: "BOOKINGS_IMPORTED", waitFor: '[data-testid="imports-table"]' },
  {
    id: "10-timb-import-1-select-type",
    path: "/timb/imports/new",
    role: "timb-clerk",
    scenario: "START_OF_DAY",
    waitFor: '[data-testid="import-type-GROWER_BOOKING"]',
  },
  {
    id: "10-timb-import-2-upload",
    path: "/timb/imports/new?type=GROWER_BOOKING",
    role: "timb-clerk",
    scenario: "START_OF_DAY",
    waitFor: '[data-testid="sample-booking-0917"]',
    tall: true,
  },
  {
    id: "10-timb-import-3-validate-renamed",
    path: "/timb/imports/new?type=GROWER_BOOKING",
    role: "timb-clerk",
    scenario: "START_OF_DAY",
    waitFor: '[data-testid="sample-booking-renamed"]',
    before: async (page) => {
      await page.getByTestId("sample-booking-renamed").click();
      await expect(page.getByTestId("validation-error")).toBeVisible();
    },
  },
  {
    id: "10-timb-import-4-preview-with-errors",
    path: "/timb/imports/new?type=GROWER_BOOKING",
    role: "timb-clerk",
    scenario: "START_OF_DAY",
    waitFor: '[data-testid="sample-booking-0918-errors"]',
    tall: true,
    before: async (page) => {
      await page.getByTestId("sample-booking-0918-errors").click();
      await page.getByTestId("validate-continue").click();
      await expect(page.getByTestId("preview-table")).toBeVisible();
    },
  },
  {
    id: "10-timb-import-6-result",
    path: "/timb/imports/new?type=GROWER_BOOKING",
    role: "timb-clerk",
    scenario: "START_OF_DAY",
    waitFor: '[data-testid="sample-booking-0918-errors"]',
    tall: true,
    before: async (page) => {
      await page.getByTestId("sample-booking-0918-errors").click();
      await page.getByTestId("validate-continue").click();
      await page.getByTestId("import-confirm-open").click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Import records" }).click();
      await expect(page.getByTestId("import-result-message")).toBeVisible();
    },
  },
  { id: "10-timb-import-detail", path: "/timb/imports/import-0001", role: "supervisor", scenario: "BOOKINGS_IMPORTED", tall: true, waitFor: '[data-testid="job-result-message"]' },
  { id: "10-timb-bookings", path: "/timb/bookings", role: "supervisor", scenario: "BOOKINGS_IMPORTED", waitFor: '[data-testid="bookings-table"]' },
  { id: "10-growers-register", path: "/growers", role: "supervisor", scenario: "PROCESSED", waitFor: '[data-testid="growers-table"]' },
  { id: "10-grower-detail-v100060", path: "/growers/V100060", role: "supervisor", scenario: "PROCESSED", tall: true },
  {
    id: "10-grower-bank-accounts",
    path: "/growers/V100074",
    role: "accounts",
    scenario: "FRESH",
    before: async (page) => {
      await page.getByTestId("tab-bank").click();
      await page.getByTestId("add-bank-account").click();
      await expect(page.getByTestId("save-bank-account")).toBeVisible();
    },
  },
  { id: "10-creditors", path: "/creditors", role: "supervisor", scenario: "PROCESSED", waitFor: '[data-testid="creditors-table"]' },
  {
    id: "10-creditor-drill-in",
    path: "/creditors",
    role: "data-processing-supervisor",
    scenario: "PROCESSED",
    waitFor: '[data-testid="creditors-table"]',
    before: async (page) => {
      await page.getByTestId("creditors-table").getByText("00050", { exact: true }).click();
      await expect(page.getByTestId("creditor-sheet")).toBeVisible();
    },
  },
  { id: "10-buyers", path: "/buyers", role: "system-admin", scenario: "FRESH", waitFor: '[data-testid="buyers-table"]' },
];
