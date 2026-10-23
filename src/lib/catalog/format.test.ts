import { describe, expect, it } from "vitest";
import {
  discountPercent,
  formatPrice,
  groupVariantsByColor,
  imageUrlForColor,
  sortSizes,
} from "./format";
import type { ProductVariant } from "./server";

function variant(over: Partial<ProductVariant>): ProductVariant {
  return { sku: "PT-1", size: "M", colorName: "Bone", colorHex: "#F1EDE4", stock: 3, ...over };
}

describe("formatPrice", () => {
  it("groups thousands the way an Indian shopper reads them", () => {
    expect(formatPrice(12990)).toBe("₹12,990");
    expect(formatPrice(890)).toBe("₹890");
  });

  it("rounds paise away and marks a missing price rather than showing ₹0", () => {
    expect(formatPrice(890.6)).toBe("₹891");
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
  });
});

describe("sortSizes", () => {
  it("follows the size ladder instead of the row order", () => {
    expect(sortSizes(["XL", "S", "XXL", "M"])).toEqual(["S", "M", "XL", "XXL"]);
  });

  it("puts unknown values after the ladder, alphabetically", () => {
    expect(sortSizes(["One", "M", "Free"])).toEqual(["M", "Free", "One"]);
  });

  it("is case-insensitive", () => {
    expect(sortSizes(["xl", "s"])).toEqual(["s", "xl"]);
  });
});

describe("groupVariantsByColor", () => {
  it("sums stock per size within a colour", () => {
    const colors = groupVariantsByColor([
      variant({ size: "M", colorName: "Bone", stock: 3 }),
      variant({ size: "M", colorName: "Bone", stock: 2 }),
      variant({ size: "L", colorName: "Bone", stock: 0 }),
    ]);
    expect(colors).toHaveLength(1);
    expect(colors[0].totalStock).toBe(5);
    expect(colors[0].sizes).toEqual([
      { size: "M", totalStock: 5 },
      { size: "L", totalStock: 0 },
    ]);
  });

  it("orders colours by name and keeps the first hex for each", () => {
    const colors = groupVariantsByColor([
      variant({ colorName: "Olive", colorHex: "#4A5238" }),
      variant({ colorName: "Black", colorHex: "#0F0F0F" }),
      variant({ colorName: "Black", colorHex: "#000000" }),
    ]);
    expect(colors.map((color) => color.name)).toEqual(["Black", "Olive"]);
    expect(colors[0].hex).toBe("#0F0F0F");
  });

  it("handles an empty variant list", () => {
    expect(groupVariantsByColor([])).toEqual([]);
  });
});

describe("imageUrlForColor", () => {
  it("returns the colour's own photo", () => {
    const variants = [
      variant({ colorName: "Bone", imageUrl: undefined }),
      variant({ colorName: "Olive", imageUrl: "https://cdn/olive.jpg" }),
    ];
    expect(imageUrlForColor(variants, "Olive")).toBe("https://cdn/olive.jpg");
    expect(imageUrlForColor(variants, "Bone")).toBeNull();
  });
});

describe("discountPercent", () => {
  it("only reports a real discount", () => {
    expect(discountPercent(890, 1290)).toBe(31);
    expect(discountPercent(890, 890)).toBeNull();
    expect(discountPercent(890, 500)).toBeNull();
    expect(discountPercent(890, null)).toBeNull();
  });
});
