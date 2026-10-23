import { describe, expect, it } from "vitest";
import {
  canPay,
  formatOrderDate,
  itemCount,
  orderStatus,
  paymentStatus,
  variantLabel,
  type Order,
} from "./format";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 47,
    userId: 1,
    orderStatus: "PENDING",
    paymentStatus: null,
    totalPrice: 1780,
    items: [],
    ...overrides,
  };
}

describe("orderStatus", () => {
  it("maps every fulfilment state to shopper language", () => {
    expect(orderStatus("PENDING").label).toBe("Processing");
    expect(orderStatus("SHIPPED").label).toBe("Shipped");
    expect(orderStatus("DELIVERED").label).toBe("Delivered");
    expect(orderStatus("CANCELLED").label).toBe("Cancelled");
  });

  it("falls back for an unknown status", () => {
    expect(orderStatus(undefined).label).toBe("Unknown");
  });
});

describe("paymentStatus", () => {
  it("treats an absent status as not-yet-started, not as an error", () => {
    expect(paymentStatus(null).label).toBe("Awaiting payment");
    expect(paymentStatus(undefined).label).toBe("Awaiting payment");
  });

  it("labels the gateway lifecycle", () => {
    expect(paymentStatus("CREATED").label).toBe("Payment pending");
    expect(paymentStatus("PAID").label).toBe("Payment captured");
    expect(paymentStatus("FAILED").label).toBe("Payment failed");
  });
});

describe("canPay", () => {
  it("offers payment for an unpaid pending order", () => {
    expect(canPay(order())).toBe(true);
    expect(canPay(order({ paymentStatus: "CREATED" }))).toBe(true);
    expect(canPay(order({ paymentStatus: "FAILED" }))).toBe(true);
  });

  it("hides payment once captured or cancelled", () => {
    expect(canPay(order({ paymentStatus: "PAID" }))).toBe(false);
    expect(canPay(order({ orderStatus: "CANCELLED" }))).toBe(false);
  });
});

describe("formatOrderDate", () => {
  it("renders an en-IN date", () => {
    expect(formatOrderDate("2026-10-23T12:00:00Z")).toBe("23 Oct 2026");
  });

  it("shows a dash for missing or invalid values", () => {
    expect(formatOrderDate(null)).toBe("—");
    expect(formatOrderDate("not-a-date")).toBe("—");
  });
});

describe("variantLabel", () => {
  it("joins the colour and size in that order", () => {
    expect(variantLabel({ variantColorName: "Bone", variantSize: "L" })).toBe("Bone · L");
  });

  it("drops missing halves instead of printing undefined", () => {
    expect(variantLabel({ variantSize: "M" })).toBe("M");
    expect(variantLabel({})).toBe("");
  });
});

describe("itemCount", () => {
  it("sums quantities rather than counting lines", () => {
    expect(
      itemCount(order({ items: [{ quantity: 2 }, { quantity: 3 }] })),
    ).toBe(5);
    expect(itemCount(order())).toBe(0);
  });
});
