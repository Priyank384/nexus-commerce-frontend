/**
 * One place for the strings that end up in <head>, the sitemap and JSON-LD, so the canonical
 * host cannot drift between them. `NEXT_PUBLIC_SITE_URL` is the only var an operator sets;
 * Vercel's own production URL is the fallback so a deploy without it still emits absolute links.
 */
export const SITE_NAME = "Nexus Commerce";
export const SITE_DESCRIPTION =
  "Considered wardrobe staples in natural fibres — menswear and womenswear made to be worn for years.";
export const SITE_LOCALE = "en_IN";

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && /^https?:\/\/[^/\s]+/i.test(configured)) return configured.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}
