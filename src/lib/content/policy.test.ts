import { afterEach, describe, expect, it, vi } from "vitest";
import { supportEmail } from "@/lib/content/policy";

afterEach(() => vi.unstubAllEnvs());

describe("supportEmail", () => {
  it("publishes the address the deployment configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "  care@nexuscommerce.test  ");
    expect(supportEmail()).toBe("care@nexuscommerce.test");
  });

  // A contact page inventing an inbox is worse than one admitting there is none: the message would
  // go somewhere nobody reads, and the shopper would never know.
  it("publishes nothing when the deployment set nothing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "");
    expect(supportEmail()).toBeNull();
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    expect(supportEmail()).toBeNull();
  });

  it("refuses a value that is not an address", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "care-at-nexus");
    expect(supportEmail()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "@nexuscommerce.test");
    expect(supportEmail()).toBeNull();
  });
});
