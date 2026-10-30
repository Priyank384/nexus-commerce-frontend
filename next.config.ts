import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Hostnames only — no scheme, port or wildcard. A raw env value like `https://x` or
// `**` in remotePatterns would either break the build or turn the image optimizer
// into an SSRF/DoS vector.
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,})$/i;

function imageHosts(): string[] {
  return (process.env.NEXT_IMAGE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean)
    .filter((host) => {
      if (HOSTNAME.test(host)) return true;
      console.warn(`[next.config] ignoring NEXT_IMAGE_HOSTS entry "${host}": not a bare hostname`);
      return false;
    });
}

// Razorpay Checkout is a script + iframe loaded from its own origin; the rest of the
// policy is the usual deny-by-default for a same-origin app. Next injects inline
// bootstrap scripts, and Tailwind/next-themes write inline styles, so both need
// 'unsafe-inline'. Dev additionally needs eval and the HMR websocket.
const csp = [
  "default-src 'self'",
  isProd ? "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com" : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  isProd
    ? "connect-src 'self' https://checkout.razorpay.com https://lumberjack.razorpay.com"
    : "connect-src 'self' ws: wss: https://checkout.razorpay.com https://lumberjack.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Only meaningful over HTTPS; sending it from a local http dev server would pin the browser.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The dev-only build indicator sits bottom-left, on top of the footer's
  // copyright line, so it lands in every shell screenshot.
  devIndicators: false,
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // The seeded catalogue points at picsum placeholders. Production uploads live in
    // Supabase Storage, whose public hostname is deployment-specific, so it comes from
    // NEXT_IMAGE_HOSTS (comma-separated, hostnames only). Local uploads still arrive
    // through /uploads.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      ...imageHosts().map((hostname) => ({ protocol: "https" as const, hostname })),
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
