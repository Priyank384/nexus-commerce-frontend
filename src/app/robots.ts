import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/site";

/** Private surfaces are already noindexed; keeping crawlers out also saves them a redirect. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/account",
          "/cart",
          "/checkout",
          "/orders",
          "/login",
          "/register",
          // Password recovery: a reset URL carries a live credential, and no crawler should be
          // offered the chance to fetch one.
          "/forgot-password",
          "/auth",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
