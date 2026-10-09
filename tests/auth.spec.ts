import { expect, test } from "playwright-test-coverage";
import type { Page } from "@playwright/test";

const diner = {
  id: "diner-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  roles: [{ role: "diner" }],
};

async function stubSignedInUser(page: Page) {
  await page.route("**/api/user/me", async (route) => {
    await route.fulfill({ json: diner });
  });
}

test("login displays a rejected attempt and then signs the diner in", async ({ page }) => {
  let loginAttempts = 0;
  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "PUT") {
      loginAttempts += 1;
      if (loginAttempts === 1) {
        await route.fulfill({ status: 401, json: { message: "Invalid credentials" } });
        return;
      }

      await route.fulfill({ json: { user: diner, token: "login-token" } });
      return;
    }

    await route.fulfill({ json: {} });
  });

  await page.goto("/login");
  await page.getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText(/Invalid credentials/)).toBeVisible();

  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Logout" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Register" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBe("login-token");
});

test("registration displays a rejected attempt and then creates the diner", async ({ page }) => {
  let registrationAttempts = 0;
  let submittedRegistration: unknown;

  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "POST") {
      registrationAttempts += 1;
      submittedRegistration = route.request().postDataJSON();
      if (registrationAttempts === 1) {
        await route.fulfill({ status: 409, json: { message: "Email already registered" } });
        return;
      }

      await route.fulfill({ json: { user: diner, token: "registration-token" } });
      return;
    }

    await route.fulfill({ json: {} });
  });

  await page.goto("/register");
  await page.getByPlaceholder("Full name").fill("Ada Lovelace");
  await page.getByPlaceholder("Email address").fill("ada@example.com");
  await page.getByLabel("Password").fill("pizza-password");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByText(/Email already registered/)).toBeVisible();

  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Logout" })).toBeVisible();
  expect(submittedRegistration).toEqual({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "pizza-password",
  });
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBe("registration-token");
});

test("logout clears the saved token and restores signed-out navigation", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("token", "logout-token"));
  await stubSignedInUser(page);
  await page.route("**/api/auth", async (route) => {
    await route.fulfill({ json: {} });
  });

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Logout" })).toBeVisible();

  await page.getByRole("link", { name: "Logout" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Logout" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});
