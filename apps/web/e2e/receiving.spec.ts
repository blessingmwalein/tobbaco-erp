import { expect, test } from "@playwright/test";
import { go, jumpTo, resetDemo, signInAs } from "./helpers";
import { createDocumentedTruck, createTransporterNote, expectFeedback, saveBale, setStartBarcode } from "./receiving-helpers";

const dialogButton = (page: import("@playwright/test").Page, name: string) => page.getByRole("alertdialog").getByRole("button", { name });

test.describe("receiving (Manual 03) and ticket printing (Manual 04)", () => {
  test("documented journey: truck → bales → tickets for V100060 and V100061", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "BOOKINGS_IMPORTED");

    await test.step("transporter note TDN0000002 with both growers", async () => {
      await createTransporterNote(page);
      await expect(page.getByTestId("note-stats")).toContainText("Number of Growers");
      // grower lookup shows the booking before adding
      await page.getByLabel(/Grower No\./).fill("100060");
      await expect(page.getByTestId("grower-lookup")).toContainText("Chengetai Chingoma");
      await expect(page.getByTestId("grower-lookup")).toContainText("3 bales booked today");
      await page.getByLabel(/Number of Bales/).fill("3");
      await page.getByTestId("add-grower").click();
      await page.getByLabel(/Grower No\./).fill("100061");
      await page.getByLabel(/Number of Bales/).fill("2");
      await page.getByTestId("add-grower").click();
      await expect(page.getByTestId("note-stats")).toContainText("5");
      await page.getByTestId("complete-delivery").click();
      await expect(page.getByTestId("confirm-complete")).toBeVisible();
      await page.getByTestId("confirm-delivery-complete").click();
      await expect(page.getByTestId("note-closed")).toContainText("Document successfully closed");
      const growers = page.getByTestId("note-growers");
      await expect(growers.getByRole("row", { name: /V100060/ })).toContainText("GDN0000005");
      await expect(growers.getByRole("row", { name: /V100061/ })).toContainText("GDN0000004");
      await expect(page.getByTestId("note-closed")).toContainText("TDN0000002");
      await expect(page.getByTestId("note-closed")).toContainText("AEX1234");
    });

    await test.step("capture V100060's three bales with the keyboard; tally 3 of 3", async () => {
      await go(page, "/floor/receiving/gdn-0000005/bales");
      await expect(page.getByTestId("tally-card")).toContainText("0 of 3");
      // keyboard path: scan + Enter moves to Group, Enter moves to Lot, Enter saves
      await page.getByTestId("bale-barcode").fill("2609170001");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("bale-group")).toBeFocused();
      await page.keyboard.type("1");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("bale-lot")).toBeFocused();
      await page.keyboard.type("1");
      await page.keyboard.press("Enter");
      await expectFeedback(page, "Bale added");
      await expect(page.getByTestId("tally-card")).toContainText("1 of 3");
      await expect(page.getByTestId("last-bale")).toContainText("112");
      // grower stays filled, barcode is cleared and focused again
      await expect(page.getByTestId("bale-grower")).toHaveValue("100060");
      await expect(page.getByTestId("bale-barcode")).toBeFocused();
      await saveBale(page, "2609170002", "1", "2");
      await expect(page.getByTestId("tally-card")).toContainText("2 of 3");
      await saveBale(page, "2609170003", "1", "3");
      await expect(page.getByTestId("tally-card")).toContainText("3 of 3");
      await expect(page.getByTestId("delivery-balanced")).toBeVisible();
      await expect(page.getByTestId("captured-bales")).toContainText("2609170003");
    });

    await test.step("complete the grower's delivery", async () => {
      await page.getByTestId("complete-grower-delivery").click();
      await dialogButton(page, "Complete Delivery").click();
      await expect(page.getByTestId("delivery-closed")).toContainText("Delivery Document #GDN0000005 for grower V100060 is closed");
      await expect(page.getByTestId("delivery-status-bar")).toHaveAttribute("data-state", "TICKETS_PRINTING");
    });

    await test.step("V100061 on its own delivery", async () => {
      await go(page, "/floor/receiving/gdn-0000004/bales");
      await saveBale(page, "2609170004", "1", "1");
      await saveBale(page, "2609170005", "1", "2");
      await expect(page.getByTestId("tally-card")).toContainText("2 of 2");
      await page.getByTestId("complete-grower-delivery").click();
      await dialogButton(page, "Complete Delivery").click();
      await expect(page.getByTestId("delivery-closed")).toContainText("GDN0000004 for grower V100061 is closed");
    });

    await test.step("tickets: start barcode allocates 1000001013 / 1000001024 / 1000001035", async () => {
      await go(page, "/floor/tickets");
      await expect(page.getByTestId("ticket-queue")).toContainText("V100060");
      await expect(page.getByTestId("ticket-queue")).toContainText("V100061");
      await page.getByTestId("ticket-queue").getByText("V100060").click();
      await expect(page).toHaveURL(/\/floor\/tickets\/gdn-0000005/);
      await expect(page.getByTestId("use-next-barcode")).toBeDisabled(); // no previous start barcode
      await setStartBarcode(page, "1000001013");
      await expect(page.getByTestId("ticket-notice")).toContainText("3 barcodes allocated (1000001013 – 1000001035)");
      const bales = page.getByTestId("ticket-bales");
      for (const b of ["1000001013", "1000001024", "1000001035"]) await expect(bales).toContainText(b);
      await expect(page.getByTestId("start-barcode")).toHaveText("1000001013");
      await expect(page.getByTestId("next-barcode")).toHaveText("1000001046");
    });

    await test.step("print preview then confirm → Checked", async () => {
      await page.evaluate(() => {
        window.print = () => {};
      });
      await page.getByTestId("print-tickets").click();
      await expect(page.getByTestId("ticket-preview")).toBeVisible();
      await expect(page.getByTestId("bale-ticket")).toHaveCount(3);
      await expect(page.getByTestId("ticket-preview")).toContainText("2609170001 - 1000001013");
      await page.getByTestId("do-print").click();
      await expect(page.getByTestId("ticket-notice")).toContainText("3 tickets sent to print preview");
      await page.getByTestId("confirm-ticket-printing").click();
      await dialogButton(page, "Confirm Ticket Printing").click();
      await expect(page.getByTestId("ticket-notice")).toContainText("Ticket printing confirmed — delivery GDN0000005 is now Checked");
      await expect(page.getByTestId("delivery-status-bar")).toHaveAttribute("data-state", "CHECKED");
    });

    await test.step("second delivery continues the roll with Use Next Barcode", async () => {
      await go(page, "/floor/tickets/gdn-0000004");
      await page.getByTestId("use-next-barcode").click();
      await expect(page.getByTestId("ticket-notice")).toContainText("2 barcodes allocated (1000001046 – 1000001057)");
      await page.getByTestId("confirm-ticket-printing").click();
      await dialogButton(page, "Confirm Ticket Printing").click();
      await expect(page.getByTestId("delivery-status-bar")).toHaveAttribute("data-state", "CHECKED");
      await expect(page.getByTestId("next-barcode")).toHaveText("1000001068");
    });

    await test.step("references stay linked in the back office", async () => {
      await go(page, "/receiving/delivery-notes/gdn-0000005");
      await expect(page.getByTestId("delivery-bales")).toContainText("1000001035");
      await expect(page.getByRole("link", { name: "TDN0000002" })).toBeVisible();
      await go(page, "/receiving/transporter-notes/tdn-0000002");
      await expect(page.getByTestId("tdn-growers")).toContainText("GDN0000004");
      await expect(page.getByTestId("tdn-growers")).toContainText("GDN0000005");
    });
  });

  test("capture validations show the manual's messages; a supervisor ejects a duplicate and the delivery completes", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "BOOKINGS_IMPORTED");
    await createDocumentedTruck(page);
    await go(page, "/floor/receiving/gdn-0000005/bales");

    // client-side validation (inline) — nothing is saved
    await saveBale(page, "123", "1", "1");
    await expect(page.getByText("Please check barcode")).toBeVisible();
    await saveBale(page, "2609170001", "0", "1");
    await expect(page.getByText("Group must be 1 or more")).toBeVisible();
    await saveBale(page, "2609170001", "1", "3a");
    await expect(page.getByText("Please enter a valid lot number").first()).toBeVisible();
    await expect(page.getByTestId("tally-card")).toContainText("0 of 3");

    // server-side rule: grower with no pending delivery
    await saveBale(page, "2609170001", "1", "1", "100043");
    await expectFeedback(page, "The grower number does not have any pending delivery note");
    // unknown scale reading
    await saveBale(page, "2609179999", "1", "1", "100060");
    await expectFeedback(page, "No scale reading found for barcode 2609179999");

    // two bales with the same group and lot
    await saveBale(page, "2609170001", "1", "1", "100060");
    await expect(page.getByTestId("tally-card")).toContainText("1 of 3");
    await saveBale(page, "2609170002", "1", "1");
    await expect(page.getByTestId("tally-card")).toContainText("2 of 3");

    // tally short
    await page.getByTestId("complete-grower-delivery").click();
    await dialogButton(page, "Complete Delivery").click();
    await expect(page.getByTestId("complete-error")).toContainText("The number of bales captured is less than number of bales delivered");

    await saveBale(page, "2609170003", "1", "3");
    await expect(page.getByTestId("tally-card")).toContainText("3 of 3");
    await page.getByTestId("complete-grower-delivery").click();
    await dialogButton(page, "Complete Delivery").click();
    await expect(page.getByTestId("complete-error")).toContainText("Repeated Group & Lot Number Combination in line 2");

    // an already-captured barcode is refused
    await saveBale(page, "2609170001", "1", "9");
    await expectFeedback(page, "already captured on this open delivery");

    // supervisor ejects the duplicate, with a reason; it is audited
    await page.getByRole("button", { name: "Eject bale 2609170002" }).click();
    await page.getByLabel(/Reason/).fill("Same lot as the first bale — wrong lot typed");
    await page.getByTestId("confirm-eject").click();
    await expect(page.getByTestId("tally-card")).toContainText("2 of 3");
    await saveBale(page, "2609170002", "1", "2");
    await expect(page.getByTestId("tally-card")).toContainText("3 of 3");
    await page.getByTestId("complete-grower-delivery").click();
    await dialogButton(page, "Complete Delivery").click();
    await expect(page.getByTestId("delivery-closed")).toContainText("GDN0000005 for grower V100060 is closed");

    await go(page, "/receiving/delivery-notes/gdn-0000005");
    await expect(page.getByText("receiving.eject-bale").first()).toBeVisible();
    await expect(page.getByText("Same lot as the first bale").first()).toBeVisible();
  });

  test("scale feed (simulated): weigh a new bale and capture it from the chips", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "BOOKINGS_IMPORTED");
    await createDocumentedTruck(page);
    await go(page, "/floor/receiving/gdn-0000004/bales");
    await expect(page.getByTestId("scale-feed")).toContainText("Simulated — not connected");
    await page.getByTestId("weigh-next").click();
    await expect(page.getByTestId("scale-feed")).toContainText("2609170006");
    // simulate scanning the first weighed bale: fills the barcode and moves to Group
    await page.getByTestId("simulate-scan").getByRole("button", { name: "2609170004" }).click();
    await expect(page.getByTestId("bale-barcode")).toHaveValue("2609170004");
    await expect(page.getByTestId("bale-group")).toBeFocused();
  });

  test("ticket printing: invalid / overlapping start barcodes, then Use Next Barcode", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "ticket-clerk");
    await jumpTo(page, "RECEIVED");
    await go(page, "/floor/tickets/gdn-0000005");

    await page.getByTestId("set-start-barcode").click();
    await page.getByTestId("start-barcode-input").fill("1000001014"); // wrong check character
    await page.getByTestId("confirm-start-barcode").click();
    await expect(page.getByText("Please enter a valid barcode")).toBeVisible();
    await page.keyboard.press("Escape");

    // nothing can be confirmed or printed before barcodes are allocated
    await expect(page.getByTestId("confirm-ticket-printing")).toBeDisabled();
    await expect(page.getByTestId("print-tickets")).toBeDisabled();
    await setStartBarcode(page, "1000001013");
    await expect(page.getByTestId("ticket-notice")).toContainText("3 barcodes allocated");

    await go(page, "/floor/tickets/gdn-0000004");
    await setStartBarcode(page, "1000001024"); // overlaps V100060's tickets
    await expect(page.getByRole("dialog")).toContainText("Barcodes already used in Tickets");
    await page.keyboard.press("Escape");
    await page.getByTestId("use-next-barcode").click();
    await expect(page.getByTestId("ticket-notice")).toContainText("2 barcodes allocated (1000001046 – 1000001057)");
  });

  test("supervisor reverses printing status with a reason; the ticket clerk cannot", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "receiving-supervisor");
    await jumpTo(page, "TICKETS_CONFIRMED");
    await go(page, "/floor/tickets/gdn-0000005");
    await expect(page.getByTestId("delivery-status-bar")).toHaveAttribute("data-state", "CHECKED");
    await page.getByTestId("reverse-printing").click();
    await page.getByLabel(/Reason/).fill("Wrong ticket roll was used");
    await page.getByTestId("confirm-reverse").click();
    await expect(page.getByTestId("ticket-notice")).toContainText("Printing status reversed for GDN0000005");
    await expect(page.getByTestId("delivery-status-bar")).toHaveAttribute("data-state", "TICKETS_PRINTING");

    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitemradio", { name: /Ticket Clerk/ }).click();
    await go(page, "/floor/tickets/gdn-0000004");
    await expect(page.getByTestId("reverse-printing")).toBeDisabled();
  });

  test("roles: ticket clerk cannot eject; receiving clerk cannot open ticket printing", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "ticket-clerk");
    await jumpTo(page, "TICKETS_CONFIRMED");
    await go(page, "/receiving/corrections");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await go(page, "/floor/receiving/gdn-0000005/bales");
    await expect(page.getByRole("button", { name: "Eject bale 2609170001" })).toBeDisabled();
    await expect(page.getByTestId("save-bale")).toBeDisabled();

    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitemradio", { name: /Receiving Clerk/ }).click();
    await go(page, "/floor/tickets");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });

  test("back office: delivery notes list, filters, detail and corrections page", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "receiving-supervisor");
    await jumpTo(page, "TICKETS_CONFIRMED");
    await go(page, "/receiving/delivery-notes");
    const table = page.getByTestId("delivery-notes-table");
    await expect(table).toContainText("GDN0000005");
    await expect(table).toContainText("GDN0000001"); // historical demo delivery
    await page.getByLabel("Filter by state").selectOption("CHECKED");
    await expect(table).toContainText("GDN0000005");
    await expect(table).not.toContainText("GDN0000001");
    await table.getByText("GDN0000005").click();
    await expect(page).toHaveURL(/delivery-notes\/gdn-0000005/);
    await expect(page.getByTestId("delivery-bales")).toContainText("1000001013");

    await go(page, "/receiving/corrections");
    await page.getByTestId("correction-barcode").fill("2609170001");
    await expect(page.getByTestId("correction-match")).toContainText("V100060");
    await page.getByTestId("eject-bale").click();
    await page.getByLabel(/Reason/).fill("Testing the correction guard");
    await page.getByTestId("confirm-eject").click();
    // Checked delivery: tickets already confirmed → refused with the explanation (UQ-17)
    await expect(page.getByRole("dialog")).toContainText("Reverse printing status first");
  });

  test("tickets overview: history and barcode stock", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "demo-operator");
    await jumpTo(page, "TICKETS_CONFIRMED");
    await go(page, "/tickets");
    await expect(page.getByTestId("ticket-queue")).toBeVisible();
    await page.getByTestId("tab-history").click();
    await expect(page.getByTestId("ticket-history")).toContainText("CONFIRM");
    await page.getByTestId("tab-stock").click();
    await expect(page.getByTestId("rolls")).toContainText("1000001068");
  });
});
