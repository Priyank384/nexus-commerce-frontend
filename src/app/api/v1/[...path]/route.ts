import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { backendUrl } from "@/lib/api/backend";

// Generic BFF proxy for every Spring REST endpoint under /api/v1/**.
// Browser traffic never hits Spring directly — this handler is the only hop.
// We forward Authorization (bearer from the client's in-memory store) plus
// any body/Content-Type the caller sent, and pipe the response back with the
// headers that no longer describe it removed (see STRIPPED_RESPONSE).
// Multipart (image upload) works because we hand the original ReadableStream
// to fetch() without touching the body.
// Default Node runtime is used — `cacheComponents` disallows an explicit
// `runtime = "nodejs"` segment config, and Node is the default anyway.

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

// Never reach Spring through this catch-all:
//  - the refresh cookie belongs to the browser and the BFF, not to Spring;
//  - forwarded-* and x-real-ip would let a caller spoof its origin/IP past the
//    backend's rate limiter and CORS handling;
//  - accept-encoding is dropped so Node fetch asks for an identity body — a
//    `br` body it cannot decode must never reach the browser.
const STRIPPED_REQUEST = new Set([
  "cookie",
  "set-cookie",
  "accept-encoding",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "forwarded",
]);

// Node's fetch transparently gunzips the upstream body, but Spring sets
// `Content-Encoding: gzip` on anything over its 2 KB compression threshold.
// Forwarding that header with an already-decoded body makes the browser abort
// with ERR_CONTENT_DECODING_FAILED, so it never survives the proxy. `set-cookie`
// is dropped because Node folds repeated headers into one comma-joined value,
// which corrupts cookies; only the BFF route handlers may set them.
const STRIPPED_RESPONSE = new Set(["content-encoding", "set-cookie"]);

// BFF-only prefixes: the browser talks to /api/auth/* handlers, and everything
// those handlers call upstream is a server-to-server call. Letting the catch-all
// reach them would hand the refresh token to JavaScript as readable JSON.
const BFF_ONLY = ["auth/"];

// Authenticated or per-user data must never be stored by a shared cache.
const PRIVATE_PREFIXES = [
  "auth/",
  "cart",
  "orders",
  "users",
  "addresses",
  "wishlist",
  "admin/",
  "payments/",
];

// Image uploads are the largest legitimate body; anything past this is abuse.
const MAX_BODY_BYTES = 10 * 1024 * 1024;

// Writes that change what the cached catalogue readers see. Reviews change a product's
// rating, so they count too.
const CATALOGUE_MUTATION = /^(?:products|categories|admin\/products|reviews)(?:\/|$)/;

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json(
    { success: false, message, error: null, data: null },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function pickRequestHeaders(req: Request): Headers {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && !STRIPPED_REQUEST.has(lower)) out.set(key, value);
  });
  return out;
}

/**
 * A path segment that decodes to `.`/`..` (or smuggles a separator) would let the
 * upstream URL resolve outside /api/v1 — e.g. %2e%2e/actuator. Reject rather than
 * normalise, so an attacker cannot probe the backend's non-public surface.
 */
function isSafeTail(tail: string): boolean {
  if (tail === "") return true;
  return tail.split("/").every((segment) => {
    if (segment === "") return false;
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return false;
    }
    return decoded !== "." && decoded !== ".." && !decoded.includes("/") && !decoded.includes("\\");
  });
}

async function proxy(req: NextRequest): Promise<Response> {
  // Derive the tail from the request URL rather than the handler's `params`
  // argument — under cacheComponents the second-arg shape isn't guaranteed.
  const full = req.nextUrl.pathname; // e.g. /api/v1/products/3
  const prefix = "/api/v1/";
  if (!full.startsWith(prefix)) return jsonError(404, "Not found");
  const tail = full.slice(prefix.length);

  if (!isSafeTail(tail)) return jsonError(404, "Not found");
  if (BFF_ONLY.some((p) => tail.startsWith(p))) return jsonError(404, "Not found");

  const base = backendUrl();
  const target = new URL(`${base}/api/v1/${tail}`);
  target.search = req.nextUrl.search;
  // Belt and braces: whatever the segment check missed, the final URL must still
  // be on the backend origin and inside /api/v1.
  if (target.origin !== new URL(base).origin || !target.pathname.startsWith("/api/v1/")) {
    return jsonError(404, "Not found");
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, "Request body too large");
  }

  const init: RequestInit = {
    method: req.method,
    headers: pickRequestHeaders(req),
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    // Stream through — supports JSON, multipart/form-data and empty bodies.
    init.body = req.body;
    // @ts-expect-error — Node fetch duplex flag required for streaming body.
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    // Log the real cause (DNS, connection refused) server-side; the browser gets
    // a generic message so infrastructure details never leak into the UI.
    console.error(`[bff] upstream ${req.method} ${target.pathname} failed:`, err);
    return jsonError(502, "Backend unreachable");
  }

  // Expire the RSC cache the moment a catalogue write lands, so the next page view
  // against this deployment already sees the change. `expire: 0` invalidates now
  // rather than serving the old value once more.
  if (req.method !== "GET" && req.method !== "HEAD" && upstream.ok && CATALOGUE_MUTATION.test(tail)) {
    revalidateTag("products", { expire: 0 });
    if (tail.startsWith("categories") || tail.startsWith("admin/products")) {
      revalidateTag("categories", { expire: 0 });
    }
  }

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && !STRIPPED_RESPONSE.has(lower)) respHeaders.set(key, value);
  });

  const isPrivate = PRIVATE_PREFIXES.some((p) => tail.startsWith(p));
  if (isPrivate) {
    respHeaders.set("Cache-Control", "no-store");
  } else if (!respHeaders.has("cache-control")) {
    respHeaders.set("Cache-Control", "public, max-age=0, must-revalidate");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
