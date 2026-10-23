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
    // The seeded catalogue points at picsum placeholders; admin uploads are served from
    // this app's own origin through the /uploads rewrite below, so they need no pattern.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
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
