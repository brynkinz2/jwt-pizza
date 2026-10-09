import { expect, test } from "playwright-test-coverage";
import type { Page } from "@playwright/test";

const menu = [
  {
    id: "pizza-1",
    title: "Margherita",
    description: "Tomato, mozzarella, and basil",
    image: "/pizza1.png",
    price: 12,
  },
  {
    id: "pizza-2",
    title: "Pepperoni",
    description: "Pepperoni and mozzarella",
    image: "/pizza2.png",
    price: 15,
  },
];

const franchise = {
  id: "franchise-1",
  name: "Provo Pizza",
  stores: [{ id: "store-1", name: "Downtown" }],
};

const orderConfirmation = {
  order: {
    id: "order-1",
    franchiseId: franchise.id,
    storeId: "store-1",
    date: "2026-10-09",
    items: [
      { menuId: "pizza-1", description: "Margherita", price: 12 },
      { menuId: "pizza-2", description: "Pepperoni", price: 15 },
    ],
  },
  jwt: "test.jwt.token",
};

type MockOptions = {
  paymentStatus?: number;
  verificationStatus?: number;
  onOrder?: (order: unknown) => void;
};

async function stubPizzaService(page: Page, options: MockOptions = {}) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname === "/api/user/me") {
      await route.fulfill({
        json: {
          id: "diner-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
          roles: [{ role: "diner" }],
        },
      });
      return;
    }

    if (pathname === "/api/order/menu") {
      await route.fulfill({ json: menu });
      return;
    }

    if (pathname === "/api/franchise") {
      await route.fulfill({ json: { franchises: [franchise], more: false } });
      return;
    }

    if (pathname === "/api/order" && request.method() === "POST") {
      options.onOrder?.(request.postDataJSON());
      if (options.paymentStatus && options.paymentStatus >= 400) {
        await route.fulfill({ status: options.paymentStatus, json: { message: "Payment declined" } });
      } else {
        await route.fulfill({ json: orderConfirmation });
      }
      return;
    }

    if (pathname === "/api/order/verify") {
      if (options.verificationStatus && options.verificationStatus >= 400) {
        await route.fulfill({ status: options.verificationStatus, json: { message: "JWT expired" } });
      } else {
        await route.fulfill({ json: { message: "valid", payload: "order-1 is authentic" } });
      }
      return;
    }

    await route.continue();
  });
}

async function signInAsDiner(page: Page) {
  await page.addInitScript(() => localStorage.setItem("token", "test-token"));
}

async function startCheckout(page: Page, pizzaCount = 1) {
  await page.goto("/menu");
  const checkout = page.getByRole("button", { name: "Checkout" });
  await expect(checkout).toBeDisabled();

  await page.getByRole("combobox").selectOption("store-1");
  await expect(checkout).toBeDisabled();

  await page.getByText("Margherita", { exact: true }).click();
  if (pizzaCount > 1) {
    await page.getByText("Pepperoni", { exact: true }).click();
  }

  await expect(page.getByText(`Selected pizzas: ${pizzaCount}`)).toBeVisible();
  await checkout.click();
  await expect(page).toHaveURL(/\/payment$/);
}

test("a diner checks out pizzas and verifies the delivered JWT", async ({ page }) => {
  let submittedOrder: unknown;
  await stubPizzaService(page, { onOrder: (order) => (submittedOrder = order) });
  await signInAsDiner(page);
  await startCheckout(page, 2);

  await expect(page.getByText("Send me those 2 pizzas right now!")).toBeVisible();
  await page.getByRole("button", { name: "Pay now" }).click();

  await expect(page).toHaveURL(/\/delivery$/);
  await expect(page.getByText("order-1")).toBeVisible();
  await expect(page.getByText("27 ₿")).toBeVisible();
  expect(submittedOrder).toMatchObject({
    franchiseId: franchise.id,
    storeId: "store-1",
    items: [
      { menuId: "pizza-1", description: "Margherita", price: 12 },
      { menuId: "pizza-2", description: "Pepperoni", price: 15 },
    ],
  });

  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("heading", { name: "JWT Pizza - valid" })).toBeVisible();
  await expect(page.getByText("order-1 is authentic")).toBeVisible();
});

test("a failed payment shows an error and cancel returns to the saved order", async ({ page }) => {
  await stubPizzaService(page, { paymentStatus: 400 });
  await signInAsDiner(page);
  await startCheckout(page);

  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByText("Payment declined")).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByText("Selected pizzas: 1")).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("store-1");
});

test("payment asks anonymous visitors to log in and delivery reports an invalid JWT", async ({ page }) => {
  await stubPizzaService(page, { verificationStatus: 400 });

  await page.goto("/payment");
  await expect(page).toHaveURL(/\/payment\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.goto("/delivery");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("heading", { name: "JWT Pizza - JWT expired" })).toBeVisible();
  await expect(page.getByText(/invalid JWT\. Looks like you have a bad pizza/)).toBeVisible();
});
