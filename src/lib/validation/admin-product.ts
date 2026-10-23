import { z } from "zod";
import type { components } from "@/lib/api/schema";
import type { AdminProduct } from "@/lib/admin/products";

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export const GENDERS = ["MEN", "WOMEN", "UNISEX", "KIDS"] as const;

export const COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

const MONEY = /^\d+(\.\d{1,2})?$/;

function money(label: string) {
  return z
    .string()
    .trim()
    .min(1, `A ${label.toLowerCase()} is required`)
    .refine((value) => MONEY.test(value), `${label} must be a number like 2499 or 2499.00`);
}

// Mirrors UpdateProductRequestDto. Numeric inputs stay strings so an empty box is "" and
// not a silent 0; the payload helpers below are the only place they become numbers.
export const productFormSchema = z
  .object({
    title: z.string().trim().min(1, "A title is required").max(255, "Titles stop at 255 characters"),
    slug: z.string().trim().max(120, "Slugs stop at 120 characters"),
    description: z.string().trim(),
    price: money("Price"),
    compareAtPrice: z
      .string()
      .trim()
      .refine((value) => value === "" || MONEY.test(value), "Compare-at must be a number like 2999"),
    stock: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+$/.test(value), "Stock must be a whole number"),
    categoryId: z.string().min(1, "Choose a category"),
    brand: z.string().trim().max(120, "Brands stop at 120 characters"),
    material: z.string().trim().max(255, "Material stops at 255 characters"),
    careInstructions: z.string().trim().max(500, "Care notes stop at 500 characters"),
    gender: z.union([z.literal(""), z.enum(GENDERS)]),
    status: z.enum(["live", "draft"]),
  })
  .refine(
    (values) => {
      const compareAt = values.compareAtPrice;
      if (compareAt === "" || !MONEY.test(values.price) || !MONEY.test(compareAt)) return true;
      return Number(compareAt) > Number(values.price);
    },
    { path: ["compareAtPrice"], message: "Compare-at must be greater than the price" },
  );

export type ProductFormValues = z.infer<typeof productFormSchema>;

export type VariantDraft = {
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  stock: number;
  priceDelta: number;
};

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalMoney(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

export function productDefaults(product?: AdminProduct): ProductFormValues {
  return {
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    price: product?.price != null ? String(product.price) : "",
    compareAtPrice: product?.compareAtPrice != null ? String(product.compareAtPrice) : "",
    stock: String(product?.stock ?? 0),
    categoryId: product?.categoryId != null ? String(product.categoryId) : "",
    brand: product?.brand ?? "",
    material: product?.material ?? "",
    careInstructions: product?.careInstructions ?? "",
    gender: (product?.gender as ProductFormValues["gender"] | undefined) ?? "",
    status: product?.isActive === false ? "draft" : "live",
  };
}

export function toCreateBody(
  values: ProductFormValues,
  variants: VariantDraft[],
): components["schemas"]["CreateProductRequestDto"] {
  return {
    title: values.title.trim(),
    description: blankToUndefined(values.description),
    price: Number(values.price),
    compareAtPrice: optionalMoney(values.compareAtPrice),
    categoryId: Number(values.categoryId),
    // Variant stock is the truth once a grid exists; the service sums it for the aggregate.
    stock: variants.length === 0 ? Number(values.stock || 0) : undefined,
    slug: blankToUndefined(values.slug),
    brand: blankToUndefined(values.brand),
    material: blankToUndefined(values.material),
    careInstructions: blankToUndefined(values.careInstructions),
    gender: values.gender === "" ? undefined : values.gender,
    isActive: values.status === "live",
    variants: variants.length === 0 ? undefined : variants,
  };
}

export function toUpdateBody(
  values: ProductFormValues,
  product: AdminProduct,
  stockApplies: boolean,
): components["schemas"]["UpdateProductRequestDto"] {
  const compareAtPrice = optionalMoney(values.compareAtPrice);
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    price: Number(values.price),
    // Null already means "leave unchanged", so taking a piece off sale needs the flag.
    ...(compareAtPrice !== undefined
      ? { compareAtPrice }
      : product.compareAtPrice != null
        ? { clearCompareAtPrice: true }
        : {}),
    stock: stockApplies ? Number(values.stock || 0) : undefined,
    categoryId: Number(values.categoryId),
    slug: blankToUndefined(values.slug),
    // Sent even when empty: the service maps blank to null, which is how a field is cleared.
    brand: values.brand.trim(),
    material: values.material.trim(),
    careInstructions: values.careInstructions.trim(),
    gender: values.gender,
    isActive: values.status === "live",
  };
}

/** SKUs are upper-cased and dash-joined by the backend; preview exactly that shape. */
export function autoSku(title: string, colorName: string, size: string): string {
  const sku = [title, colorName, size]
    .join("-")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (sku || "PIECE").slice(0, 64).replace(/-+$/, "");
}
