import { expect, test } from "@playwright/test";
import { go, jumpTo, resetDemo, signInAs } from "./helpers";
import { TICKETS, confirmPost, initiateNote, scan } from "./dispatch.helpers";

test.describe("floor dispatch (Manual 09)", () => {
  test("initiate → scan the 5 documented tickets → done → post → shipment file", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "READY_TO_DISPATCH");

    await initiateNote(page);
    await expect(page.getByRole("heading", { name: /FLDN\/2026\/09\/0001/ })).toBeVisible();

    for (const t of TICKETS) await scan(page, t);
    await expect(page.getByTestId("total-bales")).toContainText("5");
    await expect(page.getByTestId("total-mass")).toContainText("512");
    await expect(page.getByTestId("loaded-bales")).toContainText("1000001057");

    // Duplicate scan is refused — a bale cannot be dispatched twice
    await scan(page, "1000001013");
    await expect(page.getByTestId("scan-feedback")).toContainText("is already on dispatch note FLDN/2026/09/0001");
    await expect(page.getByTestId("total-bales")).toContainText("5");

    // Post is blocked until the load is marked Done
    await expect(page.getByTestId("post-dispatch")).toBeDisabled();
    await page.getByTestId("done-loading").click();
    await expect(page.getByText("Loading complete")).toBeVisible();

    await confirmPost(page);
    await expect(page.getByTestId("generate-shipment")).toBeVisible();
    await page.getByTestId("generate-shipment").click();
    await expect(page.getByText("Shipment file FLDN_2026_09_0001.csv generated (5 rows)")).toBeVisible();

    await go(page, "/dispatch/shipments");
    const table = page.getByTestId("shipments-table");
    await expect(table).toContainText("FLDN_2026_09_0001.csv");
    await expect(table).toContainText("MOCK FORMAT");
    await page.getByRole("button", { name: /Preview FLDN_2026_09_0001.csv/ }).click();
    await expect(page.getByTestId("csv-preview")).toContainText("Dispatch_Reference,Dispatch_Date,Destination_Warehouse");
    await expect(page.getByTestId("csv-preview")).toContainText("1000001046");
  });

  test("refusal: an unreleased sale cannot be dispatched", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "PROCESSED"); // processed but NOT released
    await initiateNote(page);
    await scan(page, "1000001013");
    await expect(page.getByTestId("scan-feedback")).toContainText("its sale has not been released yet");
    await expect(page.getByTestId("scan-feedback").locator("[data-result]")).toHaveAttribute("data-result", "error");
    await expect(page.getByTestId("total-bales")).toContainText("0");
  });

  test("refusal: wrong warehouse and unknown ticket (via simulate chips)", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "READY_TO_DISPATCH");
    await initiateNote(page, { warehouse: "DEMOWH2" });
    await page.getByTestId("chip-1000001013").click();
    await expect(page.getByTestId("scan-feedback")).toContainText("wrong warehouse — its buyer packs at CURVERID");
    await page.getByTestId("chip-1000009999").click();
    await expect(page.getByTestId("scan-feedback")).toContainText("Cannot find the bale: 1000009999");
  });

  test("remove a bale scanned by mistake, then cancel the draft with a reason and release its bales", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "READY_TO_DISPATCH");
    await initiateNote(page);
    await scan(page, "1000001013");
    await scan(page, "1000001024");
    await expect(page.getByTestId("total-bales")).toContainText("2");
    await page.getByTestId("remove-1000001024").click();
    await expect(page.getByTestId("total-bales")).toContainText("1");
    await expect(page.getByTestId("total-mass")).toContainText("112");

    // Cancel needs a reason
    await page.getByTestId("cancel-dispatch").click();
    const dialog = page.getByTestId("cancel-dialog");
    await dialog.getByRole("button", { name: "Cancel Dispatch" }).click();
    await expect(dialog.getByText(/A reason is required/)).toBeVisible();
    await dialog.getByLabel(/Reason/).fill("Wrong truck arrived");
    await dialog.getByRole("button", { name: "Cancel Dispatch" }).click();
    await expect(page.getByText("This dispatch note was cancelled")).toBeVisible();

    // The note is kept (never deleted) and shows as Cancelled; the bale is free for another note
    await go(page, "/dispatch");
    await expect(page.getByTestId("dispatch-notes-table")).toContainText("Cancelled");
    await initiateNote(page);
    await scan(page, "1000001013");
    await expect(page.getByTestId("scan-feedback").locator("[data-result]")).toHaveAttribute("data-result", "ok");
  });

  test("dispatch notes are never deleted — documented message", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "READY_TO_DISPATCH");
    await initiateNote(page);
    await go(page, "/dispatch");
    await page.getByRole("button", { name: "Row actions" }).first().click();
    await page.getByTestId("delete-dispatch-1").click();
    await expect(page.getByText("You cannot delete dispatch notes. Please cancel them instead.")).toBeVisible();
    await expect(page.getByTestId("dispatch-notes-table")).toContainText("FLDN/2026/09/0001");
  });

  test("empty state uses the manual's wording", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "dispatch-supervisor");
    await go(page, "/dispatch");
    await expect(page.getByText("Create your first Dispatch Note!")).toBeVisible();
    await expect(page.getByText("Dispatch Notes help you track the movement of bales from source to destination warehouses.")).toBeVisible();
  });
});

test.describe("dispatch roles", () => {
  test("clerk can load and post but cannot cancel, reset or generate the file; supervisor can", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "dispatch-clerk");
    await jumpTo(page, "READY_TO_DISPATCH");
    await initiateNote(page);
    await scan(page, "1000001013");
    await expect(page.getByTestId("cancel-dispatch")).toBeDisabled();
    await page.getByTestId("done-loading").click();
    await confirmPost(page);
    await expect(page.getByTestId("generate-shipment")).toBeDisabled();
    await expect(page.getByTestId("reset-dispatch")).toBeDisabled();

    // Supervisor generates the file, then (with a shipment file present) a reset is refused
    await signInAs(page, "dispatch-supervisor");
    await go(page, "/dispatch/dispatch-1");
    await expect(page.getByTestId("generate-shipment")).toBeEnabled();
    await page.getByTestId("generate-shipment").click();
    await expect(page.getByTestId("note-exports")).toContainText("FLDN_2026_09_0001.csv");
    await page.getByTestId("reset-dispatch").click();
    const dialog = page.getByTestId("reset-dialog");
    await dialog.getByLabel(/Reason/).fill("Load error");
    await dialog.getByRole("button", { name: "Reset to draft" }).click();
    await expect(dialog.getByText(/shipment file was already generated/)).toBeVisible();
  });

  test("supervisor cancels a clerk's draft note", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "dispatch-clerk");
    await jumpTo(page, "READY_TO_DISPATCH");
    await initiateNote(page);
    await signInAs(page, "dispatch-supervisor");
    await go(page, "/dispatch/dispatch-1");
    await page.getByTestId("cancel-dispatch").click();
    const dialog = page.getByTestId("cancel-dialog");
    await dialog.getByLabel(/Reason/).fill("Truck broke down");
    await dialog.getByRole("button", { name: "Cancel Dispatch" }).click();
    await expect(page.getByText("Reason: “Truck broke down”")).toBeVisible();
  });

  test("a role without dispatch access is blocked on the page", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "timb-clerk");
    await go(page, "/dispatch");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });
});
