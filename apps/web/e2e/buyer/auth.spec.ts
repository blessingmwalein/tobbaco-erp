import { expect, test } from "@playwright/test";
import { ACCOUNTS, BUYER_PASSWORD, gotoAuthPage, navLabels, signInBuyer, signOutBuyer } from "./helpers";

test.describe("Buyer Portal — authentication (real API)", () => {
  test("rejects a wrong password with a clear message and stays on the sign-in page", async ({ page }) => {
    await gotoAuthPage(page, "/buyer/login");
    await page.getByLabel("Email").fill(ACCOUNTS.admin);
    await page.getByLabel(/^Password/).fill("definitely-not-the-password-1");
    await page.getByTestId("buyer-sign-in").click();
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
    await expect(page).toHaveURL(/\/buyer\/login$/);
  });

  test("validates the form before calling the API", async ({ page }) => {
    await gotoAuthPage(page, "/buyer/login");
    await page.getByTestId("buyer-sign-in").click();
    await expect(page.getByText("Email is required").or(page.getByText("Enter a valid email address"))).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("credentials never end up in the URL", async ({ page }) => {
    await gotoAuthPage(page, "/buyer/login");
    await page.getByLabel("Email").fill(ACCOUNTS.admin);
    await page.getByLabel(/^Password/).fill("a-secret-that-must-not-leak-1");
    await page.getByTestId("buyer-sign-in").click();
    await expect(page).not.toHaveURL(/secret|password|email=/);
  });

  test("signs in, shows the company, survives a reload, and signs out", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    await expect(page).toHaveURL(/\/buyer\/dashboard/);
    await expect(page.getByText("MOROZ TOBACCO").first()).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("buyer-user-menu")).toBeVisible(); // session restored from the refresh token

    await signOutBuyer(page);
    await page.goto("/buyer/dashboard");
    await page.waitForURL(/\/buyer\/login\?next=/); // signed out for real: the portal asks for credentials again
  });

  test("an anonymous deep link goes to sign-in and returns to the page afterwards", async ({ page }) => {
    await page.goto("/buyer/account");
    await page.waitForURL(/\/buyer\/login\?next=%2Fbuyer%2Faccount/);
    await page.locator('main[data-hydrated="true"]').waitFor();
    await page.getByLabel("Email").fill(ACCOUNTS.admin);
    await page.getByLabel(/^Password/).fill(BUYER_PASSWORD);
    await page.getByTestId("buyer-sign-in").click();
    await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  });

  test("navigation follows the brief and is trimmed to the user's role", async ({ page }) => {
    await signInBuyer(page, ACCOUNTS.admin);
    const admin = await navLabels(page);
    expect(admin).toEqual(
      expect.arrayContaining(["Dashboard", "Invoices Import", "Invoices", "Purchase Register", "Invoice Shipments", "Bales Receiving", "Receiving Reconciliation", "Warehouse Inventory", "Bale Traceability", "Purchase Reports", "Receiving Reports", "Inventory Reports", "Buyer Users", "Company Profile", "Account Settings"]),
    );
    await signOutBuyer(page);

    await signInBuyer(page, ACCOUNTS.viewer);
    const viewer = await navLabels(page);
    expect(viewer).toContain("Dashboard");
    expect(viewer).not.toContain("Buyer Users"); // a Viewer cannot manage users
    expect(viewer).not.toContain("Company Profile");
  });

  test("forgot-password never reveals whether an email exists", async ({ page }) => {
    await gotoAuthPage(page, "/buyer/forgot-password");
    await page.getByLabel("Email").fill("nobody-here@example.test");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If that address belongs to an active account")).toBeVisible();
  });

  test("an invalid activation link is explained, not a blank page", async ({ page }) => {
    await gotoAuthPage(page, "/buyer/activate");
    await expect(page.getByText("This link is not valid")).toBeVisible();
  });
});
