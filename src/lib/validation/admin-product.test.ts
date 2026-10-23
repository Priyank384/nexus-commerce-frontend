import { describe, expect, it } from "vitest";
import type { AdminProduct } from "@/lib/admin/products";
import { buildVariants, emptyBuilder, newColor } from "@/components/admin/variant-builder";
import {
  autoSku,
  productDefaults,
  productFormSchema,
  toCreateBody,
  toUpdateBody,
  type ProductFormValues,
} from "./admin-product";

const valid: ProductFormValues = {
  title: "Relaxed linen shirt",
  slug: "",
  description: "  ",
  price: "2499",
  compareAtPrice: "",
  stock: "4",
  categoryId: "7",
  brand: "",
  material: "",
  careInstructions: "",
  gender: "",
  status: "live",
};

const product: AdminProduct = {
  id: 11,
  title: "Relaxed linen shirt",
  price: 2499,
  compareAtPrice: 3299,
  stock: 4,
  categoryId: 7,
  isActive: true,
};

describe("productFormSchema", () => {
  it("accepts a minimal product with no compare-at price", () => {
    expect(productFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a compare-at price at or below the price", () => {
    expect(productFormSchema.safeParse({ ...valid, compareAtPrice: "2499" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...valid, compareAtPrice: "2498" }).success).toBe(false);
  });

  it("accepts a compare-at price above the price", () => {
    expect(productFormSchema.safeParse({ ...valid, compareAtPrice: "3299" }).success).toBe(true);
  });

  it("rejects a price with more than two decimals", () => {
    expect(productFormSchema.safeParse({ ...valid, price: "2499.999" }).success).toBe(false);
  });

  it("requires a category", () => {
    expect(productFormSchema.safeParse({ ...valid, categoryId: "" }).success).toBe(false);
  });

  it("rejects a negative stock", () => {
    expect(productFormSchema.safeParse({ ...valid, stock: "-1" }).success).toBe(false);
  });
});

describe("toCreateBody", () => {
  it("omits blanks and keeps the aggregate stock when there are no variants", () => {
    const body = toCreateBody(valid, []);
    expect(body).toMatchObject({
      title: "Relaxed linen shirt",
      price: 2499,
      categoryId: 7,
      stock: 4,
      isActive: true,
    });
    expect(body.description).toBeUndefined();
    expect(body.slug).toBeUndefined();
    expect(body.compareAtPrice).toBeUndefined();
    expect(body.variants).toBeUndefined();
  });

  it("leaves stock off when variants carry it", () => {
    const body = toCreateBody(valid, [
      { sku: "SHIRT-OLIVE-M", size: "M", colorName: "Olive", colorHex: "#6B6B47", stock: 3, priceDelta: 0 },
    ]);
    expect(body.stock).toBeUndefined();
    expect(body.variants).toHaveLength(1);
  });

  it("marks a draft inactive", () => {
    expect(toCreateBody({ ...valid, status: "draft" }, []).isActive).toBe(false);
  });
});

describe("toUpdateBody", () => {
  it("clears a compare-at price that the admin removed", () => {
    const body = toUpdateBody({ ...valid, compareAtPrice: "" }, product, true);
    expect(body.compareAtPrice).toBeUndefined();
    expect(body.clearCompareAtPrice).toBe(true);
  });

  it("sets a compare-at price without asking for a clear", () => {
    const body = toUpdateBody({ ...valid, compareAtPrice: "3299" }, product, true);
    expect(body.compareAtPrice).toBe(3299);
    expect(body.clearCompareAtPrice).toBeUndefined();
  });

  it("does not clear when the product had no compare-at price", () => {
    const body = toUpdateBody(valid, { ...product, compareAtPrice: undefined }, true);
    expect(body.clearCompareAtPrice).toBeUndefined();
  });

  it("sends empty text fields so the service can null them", () => {
    const body = toUpdateBody({ ...valid, brand: " ", material: "" }, product, true);
    expect(body.brand).toBe("");
    expect(body.material).toBe("");
  });

  it("omits stock for a size grid", () => {
    expect(toUpdateBody(valid, product, false).stock).toBeUndefined();
  });
});

describe("productDefaults", () => {
  it("renders a missing compare-at price as an empty box", () => {
    expect(productDefaults({ ...product, compareAtPrice: undefined }).compareAtPrice).toBe("");
  });

  it("maps an inactive product to the draft status", () => {
    expect(productDefaults({ ...product, isActive: false }).status).toBe("draft");
  });
});

describe("autoSku", () => {
  it("joins title, colour and size in the backend's uppercase dash shape", () => {
    expect(autoSku("Relaxed Linen Shirt", "Olive", "M")).toBe("RELAXED-LINEN-SHIRT-OLIVE-M");
  });

  it("folds accents and strips punctuation", () => {
    expect(autoSku("Café Shirt", "Crème Brûlée", "XL")).toBe("CAFE-SHIRT-CREME-BRULEE-XL");
  });

  it("never returns a blank SKU and stays within 64 characters", () => {
    expect(autoSku("", "", "")).toBe("PIECE");
    expect(autoSku("A".repeat(80), "Olive", "M").length).toBeLessThanOrEqual(64);
  });
});

describe("buildVariants", () => {
  const named = { ...newColor(), name: "Olive", hex: "#6B6B47" };

  it("generates one row per selected size", () => {
    const state = { ...emptyBuilder(), sizes: ["S", "M"], colors: [named] };
    const { variants, errors } = buildVariants("Relaxed linen shirt", state);
    expect(errors).toEqual([]);
    expect(variants.map((variant) => variant.size)).toEqual(["S", "M"]);
    expect(variants[0].sku).toBe("RELAXED-LINEN-SHIRT-OLIVE-S");
  });

  it("lets a reviewer override a suggested SKU", () => {
    const state = {
      ...emptyBuilder(),
      sizes: ["M"],
      colors: [named],
      edits: { [`${named.key}|M`]: { sku: "custom-sku", stock: "6", priceDelta: "100" } },
    };
    const { variants } = buildVariants("Shirt", state);
    expect(variants[0]).toMatchObject({ sku: "CUSTOM-SKU", stock: 6, priceDelta: 100 });
  });

  it("ignores colours that have not been named yet", () => {
    const state = { ...emptyBuilder(), sizes: ["M"], colors: [named, newColor()] };
    expect(buildVariants("Shirt", state).variants).toHaveLength(1);
  });

  it("rejects a malformed hex", () => {
    const state = { ...emptyBuilder(), sizes: ["M"], colors: [{ ...named, hex: "olive" }] };
    expect(buildVariants("Shirt", state).errors).toContain(
      "Colour “Olive” needs a hex like #1C1B19.",
    );
  });

  it("rejects a colour with no size selected", () => {
    const state = { ...emptyBuilder(), sizes: [], colors: [named] };
    expect(buildVariants("Shirt", state).errors).toContain(
      "Choose at least one size for the colours you added.",
    );
  });

  it("catches repeated colour names", () => {
    const state = { ...emptyBuilder(), sizes: ["M"], colors: [named, { ...newColor(), name: "olive" }] };
    expect(buildVariants("Shirt", state).errors).toContain("Colour “olive” appears twice.");
  });

  it("rejects a non-numeric stock", () => {
    const state = {
      ...emptyBuilder(),
      sizes: ["M"],
      colors: [named],
      edits: { [`${named.key}|M`]: { stock: "many", priceDelta: "" } },
    };
    expect(buildVariants("Shirt", state).errors).toContain(
      "Stock for Olive M must be a whole number.",
    );
  });
});
