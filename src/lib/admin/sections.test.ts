import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, isAdminSection } from "@/lib/admin/sections";

describe("isAdminSection", () => {
  it("lights exactly one section per path", () => {
    expect(ADMIN_SECTIONS.filter((section) => isAdminSection("/admin", section.href))).toHaveLength(1);
    expect(ADMIN_SECTIONS.filter((section) => isAdminSection("/admin/products", section.href))).toHaveLength(1);
    expect(ADMIN_SECTIONS.filter((section) => isAdminSection("/admin/products/12", section.href))).toHaveLength(1);
  });

  it("does not keep Overview lit on a deeper page", () => {
    expect(isAdminSection("/admin/products", "/admin")).toBe(false);
  });

  it("matches a nested route to its own section only", () => {
    expect(isAdminSection("/admin/products/12", "/admin/products")).toBe(true);
    expect(isAdminSection("/admin/products/12", "/admin/orders")).toBe(false);
  });
});
