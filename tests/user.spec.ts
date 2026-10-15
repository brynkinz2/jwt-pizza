import { test, expect } from "playwright-test-coverage";

test("updateUser", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
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

  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza diner");

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza diner");

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza dinerx");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza dinerx");

  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();

  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Login" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza dinerx");
});
