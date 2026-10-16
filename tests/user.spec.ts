import { test, expect } from "playwright-test-coverage";
import type { Page } from "@playwright/test";

async function stubDinerApi(page: Page, email: string) {
  let user = {
    id: "user-1",
    name: "pizza diner",
    email,
    roles: [{ role: "diner" }],
  };
  let password = "diner";

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname === "/api/auth" && request.method() === "POST") {
      const registration = request.postDataJSON();
      user = { ...user, name: registration.name, email: registration.email };
      password = registration.password;
      await route.fulfill({ json: { user, token: "registration-token" } });
      return;
    }

    if (pathname === "/api/auth" && request.method() === "PUT") {
      const login = request.postDataJSON();
      if (login.email !== user.email || login.password !== password) {
        await route.fulfill({ status: 401, json: { message: "Invalid credentials" } });
        return;
      }
      await route.fulfill({ json: { user, token: "login-token" } });
      return;
    }

    if (pathname === "/api/auth" && request.method() === "DELETE") {
      await route.fulfill({ json: { message: "logout successful" } });
      return;
    }

    if (pathname === "/api/user/me") {
      await route.fulfill({ json: user });
      return;
    }

    if (pathname === `/api/user/${user.id}` && request.method() === "PUT") {
      const update = request.postDataJSON();
      user = { ...user, ...update };
      if (update.password) password = update.password;
      await route.fulfill({ json: { user, token: "updated-token" } });
      return;
    }

    await route.continue();
  });
}

async function registerAndOpenProfile(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza diner");
}

test("diner can edit their profile name", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await stubDinerApi(page, email);
  await registerAndOpenProfile(page, email);

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await expect(page.locator('[role="dialog"]')).toHaveClass(/opened/);
  await page.getByRole("textbox").first().fill("pizza dinerx");
  await page.getByRole("button", { name: "Update" }).click();

  await expect(page.locator('[role="dialog"]')).toBeHidden();
  await expect(page.getByRole("main")).toContainText("pizza dinerx");
});

test("diner profile changes persist after logging in again", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await stubDinerApi(page, email);
  await registerAndOpenProfile(page, email);

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator('[role="dialog"]')).toHaveClass(/opened/);
  await page.getByRole("textbox").first().fill("pizza dinerx");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.locator('[role="dialog"]')).toBeHidden();
  await expect(page.getByRole("main")).toContainText("pizza dinerx");

  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();

  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Login" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza dinerx");
});

test("diner order history displays a formatted date", async ({ page }) => {
  const email = `date${Math.floor(Math.random() * 10000)}@jwt.com`;
  const user = {
    id: "user-date",
    name: "Date Diner",
    email,
    roles: [{ role: "diner" }],
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/auth" && request.method() === "POST") {
      await route.fulfill({ json: { user, token: "registration-token" } });
      return;
    }
    if (pathname === "/api/order" && request.method() === "GET") {
      await route.fulfill({
        json: {
          id: "history-1",
          dinerId: user.id,
          orders: [{
            id: "order-1",
            franchiseId: "franchise-1",
            storeId: "store-1",
            date: "2026-10-15T12:00:00.000Z",
            items: [{ menuId: "pizza-1", description: "Cheese pizza", price: 12 }],
          }],
        },
      });
      return;
    }
    if (pathname === "/api/user/me") {
      await route.fulfill({ json: user });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill(user.name);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();
  await page.getByRole("link", { name: "dd" }).click();

  const ordersTable = page.getByRole("table");
  await expect(ordersTable.getByText("10/15/2026")).toBeVisible();
  await expect(ordersTable.getByText("2026-10-15T12:00:00.000Z")).toHaveCount(0);
});
