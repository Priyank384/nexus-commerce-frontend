import { describe, expect, it } from "vitest";
import { addressSchema, contactSchema } from "./checkout";

describe("addressSchema", () => {
  const valid = {
    recipientName: "Asha Rao",
    phone: "+91 98000 00000",
    line1: "14 Lavelle Road",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
  };

  it("accepts a complete Indian address", () => {
    expect(addressSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a phone number with letters", () => {
    const result = addressSchema.safeParse({ ...valid, phone: "call-me" });
    expect(result.success).toBe(false);
  });

  it("rejects a one-character postal code", () => {
    expect(addressSchema.safeParse({ ...valid, postalCode: "5" }).success).toBe(false);
  });

  it("requires the city", () => {
    expect(addressSchema.safeParse({ ...valid, city: "  " }).success).toBe(false);
  });
});

describe("contactSchema", () => {
  it("accepts a name, valid email and phone", () => {
    expect(
      contactSchema.safeParse({ name: "Asha Rao", email: "asha@example.com", phone: "9800000000" })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(
      contactSchema.safeParse({ name: "Asha Rao", email: "asha@", phone: "9800000000" }).success,
    ).toBe(false);
  });

  it("rejects a single-character name", () => {
    expect(
      contactSchema.safeParse({ name: "A", email: "asha@example.com", phone: "9800000000" }).success,
    ).toBe(false);
  });
});
