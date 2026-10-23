import type { ProductVariant } from "./server";

/** en-IN groups thousands the way an Indian shopper reads them: 12,900 not 12.900. */
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(rupees: number | null | undefined): string {
  return rupees == null ? "—" : inr.format(Math.round(rupees));
}

/**
 * The backend returns variants in whatever order the rows came back in, which put L before M.
 * Anything the shopper sees has to follow the size ladder, with unknown values after it.
 */
export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export function sizeRank(size: string): number {
  const index = (SIZE_ORDER as readonly string[]).indexOf(size.toUpperCase());
  return index === -1 ? SIZE_ORDER.length : index;
}

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));
}

export type ColorOption = {
  name: string;
  /** First hex seen for the name; the seed data keeps one per colour. */
  hex: string | null;
  totalStock: number;
  sizes: { size: string; totalStock: number }[];
};

/**
 * Collapses the flat variant list into the shape a picker needs: colours across the top,
 * sizes down the side, each cell knowing whether it can actually be bought.
 */
export function groupVariantsByColor(variants: ProductVariant[]): ColorOption[] {
  const byColor = new Map<string, ColorOption>();
  const sizeTotals = new Map<string, Map<string, number>>();

  for (const variant of variants) {
    const name = variant.colorName ?? "Other";
    const size = variant.size ?? "ONE";
    const stock = variant.stock ?? 0;

    let color = byColor.get(name);
    if (!color) {
      color = { name, hex: variant.colorHex ?? null, totalStock: 0, sizes: [] };
      byColor.set(name, color);
      sizeTotals.set(name, new Map());
    }
    color.totalStock += stock;
    const sizes = sizeTotals.get(name)!;
    sizes.set(size, (sizes.get(size) ?? 0) + stock);
  }

  const options = [...byColor.values()];
  for (const option of options) {
    const sizes = sizeTotals.get(option.name)!;
    option.sizes = [...sizes.entries()]
      .map(([size, totalStock]) => ({ size, totalStock }))
      .sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

/** The gallery shows a colour's own photo when it has one, so the swatch matches the picture. */
export function imageUrlForColor(variants: ProductVariant[], colorName: string): string | null {
  return variants.find((v) => v.colorName === colorName && v.imageUrl)?.imageUrl ?? null;
}

export function discountPercent(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
