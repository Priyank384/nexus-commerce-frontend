import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { configure } from "@testing-library/react";
import { server } from "./mocks/server";

// jsdom has no fetch, so vitest hands Node's undici Request, which — unlike a browser —
// refuses a relative URL. The API client is built on a same-origin relative baseUrl, so
// resolve against a fixed origin here rather than teach production code about the test env.
const BrowserRequest = globalThis.Request;
class RequestWithBase extends BrowserRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(
      typeof input === "string" && input.startsWith("/") ? new URL(input, "http://localhost:3000") : input,
      init,
    );
  }
}
globalThis.Request = RequestWithBase as unknown as typeof Request;

// A component test's waitFor defaults to one second, which a loaded machine can spend before a
// stubbed request even reaches the recorder — and the failure then looks like a broken feature.
configure({ asyncUtilTimeout: 2_000 });

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
