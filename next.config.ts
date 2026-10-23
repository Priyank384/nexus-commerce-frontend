import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The dev-only build indicator sits bottom-left, on top of the footer's
  // copyright line, so it lands in every shell screenshot.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // The seeded catalogue points at picsum placeholders. Production uploads live in R2,
    // whose public hostname is deployment-specific, so it comes from NEXT_IMAGE_HOSTS
    // (comma-separated, hostnames only). Local uploads still arrive through /uploads.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      ...(process.env.NEXT_IMAGE_HOSTS ?? "")
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean)
        .map((hostname) => ({ protocol: "https" as const, hostname })),
    ],
  },
  async rewrites() {
    const base = process.env.API_BASE_URL;
    if (!base) return [];
    // Serve uploaded product images through the frontend origin so
    // <img src="/uploads/products/x.png"> works without the browser
    // needing to know the backend port.
    return [
      { source: "/uploads/:path*", destination: `${base}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
