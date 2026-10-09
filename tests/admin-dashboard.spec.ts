import { expect, test } from "playwright-test-coverage";
import type { Page } from "@playwright/test";

const admin = {
  id: "admin-1",
  name: "Mama Ricci",
  email: "mama@example.com",
  roles: [{ role: "admin" }],
};

const diner = {
  id: "diner-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  roles: [{ role: "diner" }],
};

type Store = { id: string; name: string; totalRevenue?: number };
type Franchise = { id: string; name: string; admins: { name: string; email: string }[]; stores: Store[] };
type FranchiseList = { franchises: Franchise[]; more: boolean };

type ApiOptions = {
  user?: typeof admin | typeof diner;
  getFranchises: (page: number, limit: number, name: string) => FranchiseList;
  onCreateFranchise?: (franchise: Franchise) => void;
  onCloseFranchise?: (franchiseId: string) => void;
  onCloseStore?: (franchiseId: string, storeId: string) => void;
};

async function stubAdminApi(page: Page, options: ApiOptions) {
  await page.addInitScript(() => localStorage.setItem("token", "admin-dashboard-token"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());

    if (pathname === "/api/user/me") {
      await route.fulfill({ json: options.user ?? admin });
      return;
    }

    if (pathname === "/api/franchise" && request.method() === "GET") {
      const result = options.getFranchises(
        Number(searchParams.get("page")),
        Number(searchParams.get("limit")),
        searchParams.get("name") ?? "",
      );
      await route.fulfill({ json: result });
      return;
    }

    if (pathname === "/api/franchise" && request.method() === "POST") {
      const createdFranchise = request.postDataJSON();
      options.onCreateFranchise?.(createdFranchise);
      await route.fulfill({ json: createdFranchise });
      return;
    }

    const closeStoreMatch = pathname.match(/^\/api\/franchise\/([^/]+)\/store\/([^/]+)$/);
    if (closeStoreMatch && request.method() === "DELETE") {
      options.onCloseStore?.(closeStoreMatch[1], closeStoreMatch[2]);
      await route.fulfill({ json: null });
      return;
    }

    const closeFranchiseMatch = pathname.match(/^\/api\/franchise\/([^/]+)$/);
    if (closeFranchiseMatch && request.method() === "DELETE") {
      options.onCloseFranchise?.(closeFranchiseMatch[1]);
      await route.fulfill({ json: null });
      return;
    }

    await route.continue();
  });
}

test("a non-admin cannot use the admin dashboard", async ({ page }) => {
  await stubAdminApi(page, {
    user: diner,
    getFranchises: () => ({ franchises: [], more: false }),
  });

  await page.goto("/admin-dashboard");

  await expect(page.getByRole("heading", { name: "Oops" })).toBeVisible();
  await expect(page.getByText(/dropped a pizza on the floor/i)).toBeVisible();
});

test("an admin can filter franchises and move between result pages", async ({ page }) => {
  const provo: Franchise = {
    id: "franchise-1",
    name: "Provo Pizza",
    admins: [{ name: "Rosa Ricci", email: "rosa@example.com" }],
    stores: [{ id: "store-1", name: "Downtown", totalRevenue: 1234 }],
  };
  const saltLake: Franchise = {
    id: "franchise-2",
    name: "Salt Lake Pizza",
    admins: [{ name: "Luigi Ricci", email: "luigi@example.com" }],
    stores: [{ id: "store-2", name: "Main Street", totalRevenue: 2500 }],
  };
  const requests: { page: number; limit: number; name: string }[] = [];
  await stubAdminApi(page, {
    getFranchises: (pageIndex, limit, name) => {
      requests.push({ page: pageIndex, limit, name });
      if (name.includes("Provo")) return { franchises: [provo], more: false };
      if (pageIndex === 1) return { franchises: [saltLake], more: false };
      return { franchises: [provo], more: true };
    },
  });

  await page.goto("/admin-dashboard");
  await expect(page.getByText("Provo Pizza")).toBeVisible();
  await expect(page.getByText("Rosa Ricci")).toBeVisible();
  await expect(page.getByText("1,234 ₿")).toBeVisible();

  await page.getByRole("button", { name: "»" }).click();
  await expect(page.getByText("Salt Lake Pizza")).toBeVisible();
  await expect(page.getByRole("button", { name: "»" })).toBeDisabled();

  await page.getByRole("button", { name: "«" }).click();
  await expect(page.getByText("Provo Pizza")).toBeVisible();

  await page.getByPlaceholder("Filter franchises").fill("Provo");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Provo Pizza")).toBeVisible();
  expect(requests).toContainEqual({ page: 0, limit: 10, name: "*Provo*" });
});

test("an admin can create a franchise", async ({ page }) => {
  const franchises: Franchise[] = [];
  let submittedFranchise: unknown;
  await stubAdminApi(page, {
    getFranchises: () => ({ franchises, more: false }),
    onCreateFranchise: (created) => {
      submittedFranchise = created;
      franchises.push({ ...created, id: "franchise-new" });
    },
  });

  await page.goto("/admin-dashboard");
  await page.getByRole("button", { name: "Add Franchise" }).click();
  await expect(page).toHaveURL(/\/admin-dashboard\/create-franchise$/);
  await page.getByPlaceholder("franchise name").fill("JWT Valley");
  await page.getByPlaceholder("franchisee admin email").fill("owner@example.com");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  await expect(page.getByText("JWT Valley")).toBeVisible();
  expect(submittedFranchise).toEqual({
    stores: [],
    id: "",
    name: "JWT Valley",
    admins: [{ email: "owner@example.com" }],
  });
});

test("an admin can close a store and then its franchise", async ({ page }) => {
  const stores: Store[] = [{ id: "store-1", name: "Downtown", totalRevenue: 1234 }];
  const franchises: Franchise[] = [
    {
      id: "franchise-1",
      name: "Provo Pizza",
      admins: [{ name: "Rosa Ricci", email: "rosa@example.com" }],
      stores,
    },
  ];
  await stubAdminApi(page, {
    getFranchises: () => ({ franchises, more: false }),
    onCloseStore: (franchiseId, storeId) => {
      const franchiseIndex = franchises.findIndex((item) => item.id === franchiseId);
      const storeIndex = stores.findIndex((item) => item.id === storeId);
      if (franchiseIndex >= 0 && storeIndex >= 0) stores.splice(storeIndex, 1);
    },
    onCloseFranchise: (franchiseId) => {
      const franchiseIndex = franchises.findIndex((item) => item.id === franchiseId);
      if (franchiseIndex >= 0) franchises.splice(franchiseIndex, 1);
    },
  });

  await page.goto("/admin-dashboard");
  await page.getByRole("row").filter({ hasText: "Downtown" }).getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Sorry to see you go" })).toBeVisible();
  await expect(page.getByText(/store Downtown/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/admin-dashboard$/);
  await expect(page.getByText("Downtown", { exact: true })).toHaveCount(0);

  await page.getByRole("row").filter({ hasText: "Provo Pizza" }).getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(/close the Provo Pizza franchise/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/admin-dashboard$/);
  await expect(page.getByText("Provo Pizza", { exact: true })).toHaveCount(0);
});
