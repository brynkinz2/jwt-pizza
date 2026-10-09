import { expect, test } from "playwright-test-coverage";
import type { Page } from "@playwright/test";

const diner = {
  id: "diner-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  roles: [
    { role: "diner" },
    { role: "franchisee", objectId: "franchise-1" },
  ],
};

async function openDashboard(page: Page, orders: unknown[]) {
  await page.addInitScript(() => localStorage.setItem("token", "dashboard-token"));
  await page.route("**/api/user/me", async (route) => {
    await route.fulfill({ json: diner });
  });
  await page.route("**/api/order", async (route) => {
    await route.fulfill({ json: { id: "history-1", dinerId: diner.id, orders } });
  });

  await page.goto("/diner-dashboard");
  await expect(page.getByRole("heading", { name: "Your pizza kitchen" })).toBeVisible();
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByText("ada@example.com")).toBeVisible();
}

test("a diner with no orders sees the empty history message", async ({ page }) => {
  await openDashboard(page, []);

  await expect(page.getByText(/How have you lived this long without having a pizza\?/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Buy one" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("a diner sees order totals, dates, and formatted roles in their history", async ({ page }) => {
  await openDashboard(page, [
    {
      id: "order-42",
      date: "2026-10-01",
      items: [
        { menuId: "pizza-1", description: "Margherita", price: 12 },
        { menuId: "pizza-2", description: "Pepperoni", price: 15 },
      ],
    },
    {
      id: "order-43",
      date: "2026-10-08",
      items: [{ menuId: "pizza-1", description: "Margherita", price: 12 }],
    },
  ]);

  await expect(page.getByText("Franchisee on franchise-1")).toBeVisible();
  const globalNavigation = page.getByRole("navigation", { name: "Global" });
  await expect(globalNavigation.getByRole("link", { name: "Franchise" })).toBeVisible();
  await expect(globalNavigation.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByText("Here is your history of all the good times.")).toBeVisible();
  await expect(page.getByRole("table").getByText("order-42")).toBeVisible();
  await expect(page.getByRole("table").getByText("order-43")).toBeVisible();
  await expect(page.getByRole("table").getByText("27 ₿")).toBeVisible();
  await expect(page.getByRole("table").getByText("12 ₿")).toBeVisible();
  await expect(page.getByRole("table").getByText("2026-10-01")).toBeVisible();
});
