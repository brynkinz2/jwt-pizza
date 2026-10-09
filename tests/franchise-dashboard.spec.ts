import { expect, test } from "playwright-test-coverage";
import type { Page } from "@playwright/test";

const franchisee = {
  id: "franchisee-1",
  name: "Rosa Ricci",
  email: "rosa@example.com",
  roles: [{ role: "franchisee", objectId: "franchise-1" }],
};

const franchise = {
  id: "franchise-1",
  name: "Provo Pizza",
  admins: [{ id: franchisee.id, name: franchisee.name, email: franchisee.email }],
};

type ApiOptions = {
  getStores: () => { id: string; name: string; totalRevenue?: number }[];
  onCreateStore?: (store: { name: string }) => void;
  onCloseStore?: (storeId: string) => void;
};

async function stubFranchiseApi(page: Page, options: ApiOptions) {
  await page.addInitScript(() => localStorage.setItem("token", "franchisee-token"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname === "/api/user/me") {
      await route.fulfill({ json: franchisee });
      return;
    }

    if (pathname === `/api/franchise/${franchisee.id}` && request.method() === "GET") {
      const stores = options.getStores();
      await route.fulfill({ json: stores.length ? [{ ...franchise, stores }] : [] });
      return;
    }

    if (pathname === `/api/franchise/${franchise.id}/store` && request.method() === "POST") {
      options.onCreateStore?.(request.postDataJSON());
      await route.fulfill({ json: { id: "store-2", ...request.postDataJSON() } });
      return;
    }

    const closeStoreMatch = pathname.match(/^\/api\/franchise\/franchise-1\/store\/([^/]+)$/);
    if (closeStoreMatch && request.method() === "DELETE") {
      options.onCloseStore?.(closeStoreMatch[1]);
      await route.fulfill({ json: null });
      return;
    }

    await route.continue();
  });
}

test("a franchisee without a franchise sees the application prompt", async ({ page }) => {
  await stubFranchiseApi(page, { getStores: () => [] });

  await page.goto("/franchise-dashboard");

  await expect(page.getByRole("heading", { name: "So you want a piece of the pie?" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("If you are already a franchisee");
  await expect(page.getByRole("link", { name: "login" })).toHaveAttribute("href", "/franchise-dashboard/login");
  await expect(page.getByRole("link", { name: "800-555-5555" })).toHaveAttribute("href", "tel:800-555-5555");
});

test("a franchisee can create a store and return to the updated dashboard", async ({ page }) => {
  const stores = [{ id: "store-1", name: "Downtown", totalRevenue: 1234 }];
  let submittedStore: unknown;
  await stubFranchiseApi(page, {
    getStores: () => stores,
    onCreateStore: (store) => {
      submittedStore = store;
      stores.push({ id: "store-2", name: store.name, totalRevenue: 0 });
    },
  });

  await page.goto("/franchise-dashboard");
  await expect(page.getByRole("heading", { name: "Provo Pizza" })).toBeVisible();
  await expect(page.getByText("1,234 ₿")).toBeVisible();

  await page.getByRole("button", { name: "Create store" }).click();
  await expect(page).toHaveURL(/\/franchise-dashboard\/create-store$/);
  await page.getByPlaceholder("store name").fill("Campus");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByText("Campus")).toBeVisible();
  expect(submittedStore).toEqual({ id: "", name: "Campus" });
});

test("a franchisee can cancel or confirm closing a store", async ({ page }) => {
  const stores = [{ id: "store-1", name: "Downtown", totalRevenue: 1234 }];
  let closedStoreId: string | undefined;
  await stubFranchiseApi(page, {
    getStores: () => stores,
    onCloseStore: (storeId) => {
      closedStoreId = storeId;
      const storeIndex = stores.findIndex((store) => store.id === storeId);
      if (storeIndex >= 0) stores.splice(storeIndex, 1);
    },
  });

  await page.goto("/franchise-dashboard");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Sorry to see you go" })).toBeVisible();
  await expect(page.getByText(/store Downtown/)).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByText("Downtown")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByText("Downtown", { exact: true })).toHaveCount(0);
  expect(closedStoreId).toBe("store-1");
});
