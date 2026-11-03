/**
 * The merchant decisions behind the policy pages, in one file.
 *
 * These numbers are not derived from the database — no table holds a returns window — so they
 * live here where changing one changes every page that quotes it. Anything that *is* derived
 * from how the store actually works (statuses an order can hold, the fact that checkout adds no
 * delivery fee, prepaid-only payment) is written as behaviour the code really has, because a
 * policy page that promises a mechanism the API does not implement is worse than no policy page.
 */

/** Calendar days from delivery inside which a shopper can tell us they want to send a piece back. */
export const RETURN_WINDOW_DAYS = 14;

/** Working days from a settled payment until the parcel leaves the shelf. */
export const DISPATCH_WITHIN_WORKING_DAYS = 2;

/** Working days from dispatch until the parcel is handed over, domestic. */
export const DELIVERY_ESTIMATE_WORKING_DAYS = { min: 3, max: 7 };

/** Working hours we aim to answer a shopper within. */
export const SUPPORT_RESPONSE_WORKING_HOURS = 24;

/** Working days after we receive a return before the money is on its way back. */
export const REFUND_WORKING_DAYS = { min: 5, max: 7 };

/** Shown on every policy page so a shopper knows which version of the text they are reading. */
export const POLICY_LAST_UPDATED = "4 November 2026";

/**
 * The address a shopper can write to. Nothing is invented here: the storefront only publishes an
 * inbox the operator has actually configured, and the contact page says what happens when there
 * is none yet.
 */
export function supportEmail(): string | null {
  const configured = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (!configured || !configured.includes("@") || configured.startsWith("@")) return null;
  return configured;
}

/** The sizes this catalogue sells, as the seeded apparel line and the variant table define them. */
export const SIZE_LADDER = ["S", "M", "L", "XL"] as const;

/** Products with no size choice at all — the `ONE` variant legacy rows and one-size goods use. */
export const ONE_SIZE_LABEL = "ONE";

/**
 * The store's grading blocks, flat-measured in inches — the same table the product page's fit
 * dialog quotes, kept here so the two cannot drift into disagreeing about what a size M is.
 *
 * It describes the block a size is cut from, not a garment that has been measured on a table:
 * the catalogue stores a size as a label on a variant, with no per-piece measurements behind it.
 * Anything that reads these numbers has to say so, which is why both consumers import them
 * instead of retyping them.
 */
export const FIT_TABLE: { size: string; chest: string; length: string }[] = [
  { size: "XS", chest: '34–36"', length: '27"' },
  { size: "S", chest: '37–39"', length: '28"' },
  { size: "M", chest: '40–42"', length: '29"' },
  { size: "L", chest: '43–45"', length: '30"' },
  { size: "XL", chest: '46–48"', length: '31"' },
  { size: "XXL", chest: '49–51"', length: '32"' },
];
