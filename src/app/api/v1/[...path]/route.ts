import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/api/backend";

// Generic BFF proxy for every Spring REST endpoint under /api/v1/**.
// Browser traffic never hits Spring directly — this handler is the only hop.
// We forward Authorization (bearer from the client's in-memory store) plus
// any body/Content-Type the caller sent, and pipe the response back verbatim.
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

function pickHeaders(req: Request): Headers {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  });
  return out;
}

async function proxy(req: NextRequest): Promise<Response> {
  // Derive the tail from the request URL rather than the handler's `params`
  // argument — under cacheComponents the second-arg shape isn't guaranteed.
  const full = req.nextUrl.pathname; // e.g. /api/v1/products/3
  const prefix = "/api/v1/";
  const tail = full.startsWith(prefix) ? full.slice(prefix.length) : full;
  const search = req.nextUrl.search;
  const url = `${backendUrl()}/api/v1/${tail}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: pickHeaders(req),
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
    upstream = await fetch(url, init);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: "Backend unreachable",
        error: err instanceof Error ? err.message : String(err),
        data: null,
      },
      { status: 502 },
    );
  }

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) respHeaders.set(key, value);
  });
  respHeaders.set("Cache-Control", "no-store");

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
