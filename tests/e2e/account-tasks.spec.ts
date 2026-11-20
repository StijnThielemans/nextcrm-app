import { test, expect } from "@playwright/test";

test.describe("CRM account page", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("does not show activities, tasks, contacts or documents", async ({ page }) => {
    await page.goto("/en/crm/accounts");
    await page.waitForURL(/crm\/accounts/, { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await page
      .getByTestId("accounts-table")
      .getByTestId("account-row-name")
      .first()
      .click();

    await page.waitForURL(/crm\/accounts\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const body = page.locator("body");
    await expect(body.getByText("Activiteiten")).toHaveCount(0);
    await expect(body.getByText("Find Similar")).toHaveCount(0);
    await expect(body.getByText("No assigned tasks found")).toHaveCount(0);
    await expect(body.getByText("No assigned contacts found")).toHaveCount(0);
    await expect(body.getByText("No assigned documents found")).toHaveCount(0);
    await expect(body.getByRole("heading", { name: "Customer" })).toBeVisible();
    await expect(body.getByRole("heading", { name: "Quote dossiers" })).toBeVisible();
  });
});
