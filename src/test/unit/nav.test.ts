import { describe, it, expect } from "vitest";
import { NAV_ITEMS, ROLES, DEFAULT_ROLE_PERMISSIONS } from "@/data/nav";

describe("Unit: Navigation & RBAC Permissions (data/nav)", () => {
  it("NAV_ITEMS should have unique keys and valid href paths", () => {
    const keys = new Set<string>();
    for (const item of NAV_ITEMS) {
      expect(keys.has(item.key)).toBe(false);
      keys.add(item.key);
      expect(item.key.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });

  it("NAV_ITEMS should contain core navigation entries including compliance and tasks", () => {
    const keys = NAV_ITEMS.map((i) => i.key);
    expect(keys).toContain("dashboard");
    expect(keys).toContain("applications");
    expect(keys).toContain("standards");
    expect(keys).toContain("assessments");
    expect(keys).toContain("tasks");
    expect(keys).toContain("compliance");
    expect(keys).toContain("settings");
  });

  it("ROLES should define all supported system roles", () => {
    const roleKeys = ROLES.map((r) => r.key);
    expect(roleKeys).toContain("viewer");
    expect(roleKeys).toContain("editor");
    expect(roleKeys).toContain("security");
    expect(roleKeys).toContain("architecture");
    expect(roleKeys).toContain("developer");
    expect(roleKeys).toContain("admin");
  });

  it("DEFAULT_ROLE_PERMISSIONS should grant admin full access and role-specific access for specialists", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("settings");
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("compliance");
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("tasks");

    expect(DEFAULT_ROLE_PERMISSIONS.security).toContain("compliance");
    expect(DEFAULT_ROLE_PERMISSIONS.security).toContain("tasks");
    expect(DEFAULT_ROLE_PERMISSIONS.security).toContain("standards");
    expect(DEFAULT_ROLE_PERMISSIONS.security).not.toContain("settings");

    expect(DEFAULT_ROLE_PERMISSIONS.developer).toContain("tasks");
    expect(DEFAULT_ROLE_PERMISSIONS.developer).not.toContain("settings");
  });
});
