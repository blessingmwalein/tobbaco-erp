import type { Page } from "@playwright/test";
import type { Screen } from "./types";

async function scan(page: Page, barcode: string) {
  const input = page.getByTestId("scanner-input");
  await input.fill(barcode);
  await input.press("Enter");
  await page.waitForTimeout(150);
}

export const SCREENS: Screen[] = [
  { id: "40-floor-summary-select", path: "/floor/floor-summary", role: "floor-summary-clerk", scenario: "TICKETS_CONFIRMED" },
  {
    id: "41-floor-summary-scanning",
    path: "/floor/floor-summary",
    role: "floor-summary-clerk",
    scenario: "TICKETS_CONFIRMED",
    tall: false,
    height: 1100,
    before: async (page) => {
      await page.getByTestId("select-selling-point-EL").click();
      await page.getByTestId("select-sale-room-A").click();
      await scan(page, "1000001013");
      await scan(page, "1000001024");
      await scan(page, "9999999999"); // a rejected scan stays visible in the history
    },
  },
  {
    id: "42-floor-summary-check",
    path: "/floor/floor-summary/check",
    role: "floor-summary-clerk",
    scenario: "FLOOR_SUMMARY_DONE",
    before: async (page) => {
      await page.getByTestId("check-grower").fill("100060");
      await page.getByTestId("check-submit").click();
      await page.getByTestId("check-result").getByText("GDN0000005").waitFor();
    },
  },
  { id: "43-floor-summary-list", path: "/floor-summary", role: "supervisor", scenario: "FLOOR_SUMMARY_DONE" },
  { id: "50-data-capture-home", path: "/floor/data-capture", role: "data-clerk", scenario: "FLOOR_SUMMARY_DONE" },
  {
    id: "51-data-capture-ebuying-form",
    path: "/floor/data-capture/e-buying",
    role: "data-clerk",
    scenario: "FLOOR_SUMMARY_DONE",
    height: 1000,
    before: async (page) => {
      await scan(page, "1000001013");
      await page.getByTestId("f-buyer").fill("jm");
      await page.getByTestId("f-bgrade").fill("zz9");
      await page.getByTestId("f-price").fill("212");
      await page.getByTestId("save-details").click();
      await page.getByText("Partly saved").waitFor();
    },
  },
  {
    id: "52-data-capture-last-bale",
    path: "/floor/data-capture/all-details",
    role: "data-clerk",
    scenario: "FLOOR_SUMMARY_DONE",
    before: async (page) => {
      await scan(page, "1000001013");
      await page.getByTestId("f-timb").fill("a10");
      await page.getByTestId("f-buyer").fill("jm");
      await page.getByTestId("f-bgrade").fill("11of");
      await page.getByTestId("f-price").fill("212");
      await page.getByTestId("save-details").click();
      await page.getByTestId("last-bale-details").getByText("212").waitFor();
    },
  },
  { id: "53-batches-list", path: "/batches", role: "demo-operator", scenario: "FLOOR_SUMMARY_DONE" },
  {
    id: "54-batch-blind-entry",
    path: "/batches/batch-4",
    role: "data-clerk",
    scenario: "FLOOR_SUMMARY_DONE",
    before: async (page) => {
      await page.getByTestId("batch-price-1000001013").fill("212");
      await page.getByTestId("batch-price-1000001013").press("Enter");
      await page.getByTestId("batch-price-1000001024").fill("198");
      await page.getByTestId("batch-price-1000001024").press("Enter");
      await page.waitForTimeout(200);
    },
  },
  { id: "55-batch-posted", path: "/batches/batch-4", role: "demo-operator", scenario: "READY_TO_BALANCE" },
  { id: "60-sales-list", path: "/sales", role: "data-processing-supervisor", scenario: "FLOOR_SUMMARY_DONE", height: 800 },
  { id: "61-sale-ready-to-balance", path: "/sales/sale-4", role: "data-processing-supervisor", scenario: "READY_TO_BALANCE", tall: true },
  { id: "62-sale-validation-showcase", path: "/sales/sale-5", role: "data-processing-supervisor", scenario: "VALIDATION_SHOWCASE", tall: true },
  { id: "63-sale-processed", path: "/sales/sale-4", role: "data-processing-supervisor", scenario: "PROCESSED", tall: true },
  {
    id: "64-approvals-pending",
    path: "/sales/sale-4",
    role: "data-processing-supervisor",
    scenario: "BALANCED",
    before: async (page) => {
      await page.getByTestId("reverse-sale").click();
      await page.getByTestId("reverse-reason").fill("Buyer grade captured wrongly on ticket 2");
      await page.getByTestId("submit-reversal").click();
      await page.getByText(/Reversal requested/).waitFor();
      await page.goto("/approvals?latency=0");
      await page.getByTestId("approvals-table").getByText("APR-0001").waitFor();
      await page.getByTestId("approvals-table").getByText("APR-0001").click();
      await page.getByTestId("approve-approval").waitFor();
    },
  },
];
