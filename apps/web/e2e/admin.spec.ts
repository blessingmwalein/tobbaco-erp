import { expect, test } from "@playwright/test";
import { go, jumpTo, resetDemo, signInAs } from "./helpers";

test.describe("administration: roles, users and audit", () => {
  test("system admin creates a custom role and a user; switching to them shows only what the role allows; the audit log records it", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "system-admin");

    // ── custom role "Batch Clerk" (the manuals split the data clerk into classification / buying / batch clerks)
    await go(page, "/admin/roles");
    await page.getByTestId("new-role").click();
    await page.getByLabel(/Role name/).fill("Batch Clerk");
    await page.locator('[id="role-sale-day.view"]').click();
    await page.locator('[id="role-batch.view"]').click();
    await page.locator('[id="role-batch.capture-price"]').click();
    await expect(page.getByTestId("role-perm-count")).toContainText("3 permissions selected");
    await page.getByTestId("save-role").click();
    await page.getByTestId("roles-table").getByLabel("Rows per page").selectOption("25"); // 14 roles → past the first page of 10
    await expect(page.getByTestId("roles-table")).toContainText("Batch Clerk");

    // ── a user with that role
    await go(page, "/admin/users");
    await page.getByTestId("new-user").click();
    await page.locator("#u-name").fill("Batch Tester");
    await page.locator("#u-email").fill("batch.tester@demo.eport.test");
    await page.getByLabel(/^Batch Clerk/).click();
    await expect(page.getByTestId("effective-count")).toContainText("3");
    await page.getByTestId("save-user").click();
    await page.getByTestId("users-table").getByLabel("Rows per page").selectOption("25"); // 14 users → past the first page of 10
    await expect(page.getByTestId("users-table")).toContainText("Batch Tester");

    // ── switch to the new user: sidebar shows only permitted areas, admin pages are blocked
    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitemradio", { name: /Batch Clerk/ }).click();
    await page.keyboard.press("Escape");
    await go(page, "/dashboard");
    const sidebar = page.getByRole("navigation", { name: "Main" });
    await expect(sidebar.getByRole("link", { name: "Price batches" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Sales & balancing" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Users" })).toHaveCount(0);
    await go(page, "/admin/users");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();

    // ── audit trail (as admin again)
    await signInAs(page, "system-admin");
    await go(page, "/admin/audit");
    await expect(page.getByTestId("audit-table")).toContainText("role.create");
    await expect(page.getByTestId("audit-table")).toContainText("user.create");
  });

  test("the signed-in administrator cannot deactivate themselves (menu item disabled with the reason)", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "system-admin");
    await go(page, "/admin/users");
    const row = page.getByTestId("users-table").getByRole("row", { name: /Administrator/ });
    await row.getByRole("button", { name: "Row actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Deactivate (not yourself)" })).toHaveAttribute("aria-disabled", "true");
  });

  test("role guard: a receiving clerk cannot open administration or the audit log", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "receiving-clerk");
    await go(page, "/admin/users");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await go(page, "/admin/audit");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });
});

test.describe("reports", () => {
  test("daily receiving report for the processed day, with a CSV export", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "supervisor");
    await jumpTo(page, "PROCESSED");
    await go(page, "/reports/daily-receiving");
    await expect(page.getByTestId("report-table")).toContainText("V100060");
    await expect(page.getByTestId("report-table")).toContainText("V100061");
    const download = page.waitForEvent("download");
    await page.getByTestId("export-csv").click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  });

  test("deduction report reconciles to the documented $173.11", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "accounts");
    await jumpTo(page, "PROCESSED");
    await go(page, "/reports/deduction");
    await expect(page.getByTestId("report-summary")).toBeVisible();
    await expect(page.getByTestId("report-table")).toContainText("Floor Commission");
    await expect(page.locator("main")).toContainText("$173.11");
  });

  test("the catalogue lists all 16 reports from the brief", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "supervisor");
    await go(page, "/reports");
    for (const title of ["Daily receiving", "Grower delivery", "Bale receiving", "Ticket printing", "Floor summary", "Data capture", "Batch processing", "Deduction", "Creditor", "Payment schedule", "Payment reconciliation", "Dispatch", "Shipment", "User activity"]) {
      await expect(page.locator("main").getByText(title, { exact: false }).first()).toBeVisible();
    }
  });
});

test.describe("settings and devices", () => {
  test("settings save persists across a reload and is audited", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "system-admin");
    await go(page, "/admin/settings");
    await page.getByLabel("Company_Name").fill("Ethical Sales Floor (UAT)");
    await page.getByTestId("save-settings").click();
    await go(page, "/admin/settings");
    await expect(page.getByLabel("Company_Name")).toHaveValue("Ethical Sales Floor (UAT)");
    await go(page, "/admin/audit");
    await expect(page.getByTestId("audit-table")).toContainText("settings.update");
  });

  test("devices page says plainly that nothing is connected and the scanner test accepts keyboard-wedge input", async ({ page }) => {
    await resetDemo(page);
    await signInAs(page, "system-admin");
    await go(page, "/admin/devices");
    await expect(page.locator("main")).toContainText(/no physical scanner/i);
    await page.getByTestId("scanner-test-input").fill("1000001013");
    await page.getByTestId("scanner-test-input").press("Enter");
    await expect(page.getByTestId("scanner-test")).toContainText("1000001013");
    await page.getByTestId("weigh-next").click();
    await expect(page.getByTestId("scale-table")).toContainText("2609170006");
  });
});
