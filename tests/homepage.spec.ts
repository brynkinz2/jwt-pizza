import { expect, test } from "playwright-test-coverage";

test("main navigation opens the home, menu, footer, and not-found pages", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());

    if (pathname === "/api/order/menu") {
      await route.fulfill({ json: [] });
      return;
    }

    if (pathname === "/api/franchise") {
      await route.fulfill({ json: { franchises: [], more: false } });
      return;
    }

    await route.continue();
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "The web's best pizza" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Global" })).toBeVisible();
  await expect(page.getByText(/Version:/)).toBeVisible();

  await page.getByRole("button", { name: "Order now" }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole("heading", { name: "Awesome is a click away" })).toBeVisible();

  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { name: "The secret sauce" })).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "Mama Rucci, my my" })).toBeVisible();

  await page.goto("/this-page-does-not-exist");
  await expect(page.getByRole("heading", { name: "Oops" })).toBeVisible();
  await expect(page.getByText(/dropped a pizza on the floor/i)).toBeVisible();
});
