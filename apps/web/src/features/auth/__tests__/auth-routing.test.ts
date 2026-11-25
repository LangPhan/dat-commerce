import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/types/auth";
import { isAdminUser, resolvePostAuthRedirect } from "../auth-context";

const adminUser: AuthUser = {
  id: "u1",
  storeId: "s1",
  storeName: "Terrain Supply",
  email: "owner@datcommerce.local",
  fullName: "Alex Morgan",
  roles: ["OWNER"],
  permissions: ["content:read", "store:write"],
};

const normalCustomer: AuthUser = {
  id: "u2",
  storeId: "s1",
  storeName: "Terrain Supply",
  email: "customer@datcommerce.local",
  fullName: "Samir Patel",
  roles: [],
  permissions: [],
};

describe("Phase 1 — Unified Auth Role & Routing Redirect", () => {
  it("distinguishes admin users with roles from normal customers with empty roles", () => {
    expect(isAdminUser(adminUser)).toBe(true);
    expect(isAdminUser(normalCustomer)).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });

  it("redirects admin to /admin (or requested next) and customer to / (blocking /admin next paths)", () => {
    expect(resolvePostAuthRedirect(adminUser, null)).toBe("/admin");
    expect(resolvePostAuthRedirect(adminUser, "/admin/editor")).toBe("/admin/editor");

    expect(resolvePostAuthRedirect(normalCustomer, null)).toBe("/");
    expect(resolvePostAuthRedirect(normalCustomer, "/admin")).toBe("/");
    expect(resolvePostAuthRedirect(normalCustomer, "/admin/products")).toBe("/");
    expect(resolvePostAuthRedirect(normalCustomer, "/store/shop")).toBe("/store/shop");
    expect(resolvePostAuthRedirect(normalCustomer, "//evil.com")).toBe("/");
  });
});
