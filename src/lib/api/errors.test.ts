import { describe, expect, it } from "vitest";
import { toAuthFailure } from "@/lib/api/errors";

// The Spring envelope puts the specific reason in `error` and only a category
// label in `message` (ApiResponse.error(ex.getMessage(), "Forbidden!")), so the
// mapper must prefer `error` — otherwise the UI shows "Duplicate resource!".
describe("toAuthFailure", () => {
  it("prefers the specific error over the generic message", () => {
    const failure = toAuthFailure(409, {
      success: false,
      message: "Duplicate resource!",
      error: "User with email 'a@b.co' already exists!",
      data: null,
    });
    expect(failure.message).toBe("User with email 'a@b.co' already exists!");
  });

  it("classifies a 403 ownership denial as forbidden", () => {
    const failure = toAuthFailure(403, {
      success: false,
      message: "Forbidden!",
      error: "You can only access your own orders",
      data: null,
    });
    expect(failure.kind).toBe("forbidden");
    expect(failure.message).toBe("You can only access your own orders");
  });

  it("recognises backend invalid credentials as a distinct kind", () => {
    expect(toAuthFailure(401, { message: "Invalid credentials!", error: "Invalid email or password!" }).kind).toBe(
      "invalid_credentials",
    );
  });

  it("falls back to the message when no error is populated", () => {
    expect(toAuthFailure(500, { message: "Something went wrong!", error: null }).message).toBe("Something went wrong!");
  });

  it("copes with a non-JSON proxied body", () => {
    expect(toAuthFailure(502, "upstream html").kind).toBe("server");
  });
});
