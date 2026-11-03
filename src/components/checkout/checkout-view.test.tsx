import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const TOKEN = "kQ7mZ2xT9vB4cL6pR8sY1uW3eA5nJ0hD7gF2kM9qXbE";

type Call = {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
  guest: string | null;
};
let calls: Call[] = [];

const CART = {
  id: 1,
  itemCount: 1,
  grandTotal: 2400,
  items: [
    {
      id: 11,
      productId: 21,
      productName: "Oxford shirt",
      quantity: 1,
      unitPrice: 2400,
      lineTotal: 2400,
    },
  ],
};

function orderEnvelope(id: number) {
  return {
    success: true,
    data: {
      id,
      totalPrice: 2400,
      orderStatus: "PENDING",
      paymentStatus: "CREATED",
      address: { recipientName: "Ada Sharma", line1: "1 MG Road", city: "Pune" },
      items: [{ productId: 21, productName: "Oxford shirt", quantity: 1, subTotal: 2400 }],
    },
  };
}

/**
 * openapi-fetch resolves globalThis.fetch when the client is constructed, so the fake has to
 * be installed before the component is imported — the api instance is a module singleton.
 */
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const path = new URL(request.url).pathname;
    const text = request.method === "GET" ? null : await request.text();
    calls.push({
      path,
      method: request.method,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
      guest: request.headers.get("X-Guest-Token"),
    });

    if (path === "/api/v1/cart") return Response.json({ success: true, data: CART });
    if (path === "/api/v1/addresses") {
      return Response.json({
        success: true,
        data: [
          {
            id: 7,
            label: "Home",
            recipientName: "Ada Sharma",
            phone: "9876543210",
            line1: "1 MG Road",
            city: "Pune",
            state: "Maharashtra",
            postalCode: "411001",
            country: "IN",
            defaultShipping: true,
          },
        ],
      });
    }
    if (path === "/api/v1/cart/checkout") return Response.json(orderEnvelope(58));
    // No gateway key: paying stops right after the order is placed, which is all these
    // tests are about.
    return Response.json({ success: true, data: {} });
  }),
);

const { CheckoutView } = await import("@/components/checkout/checkout-view");
const { useSession } = await import("@/lib/auth/session");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function renderView() {
  // retry false and no timers: a rejected call must surface in the assertion, not in a
  // second round of the test's clock.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CheckoutView />
    </QueryClientProvider>,
  );
}

function signedInJwt(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload = {
    sub: "shopper@nexus.test",
    uid: 3,
    role: "USER",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.sig`;
}

async function fillGuestDetails(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument());

  await user.type(screen.getByLabelText("Email"), "ada@example.test");
  await user.type(screen.getByLabelText("Full name"), "Ada Sharma");
  await user.type(screen.getByLabelText("Phone"), "9876543210");
  await user.click(screen.getByRole("button", { name: /continue to delivery/i }));

  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Delivery address" })).toBeInTheDocument(),
  );
  await user.type(screen.getByLabelText("Address line 1"), "1 MG Road");
  await user.type(screen.getByLabelText("City"), "Pune");
  await user.type(screen.getByLabelText("State"), "Maharashtra");
  await user.type(screen.getByLabelText("PIN code"), "411001");
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));

  await waitFor(() => expect(screen.getByRole("heading", { name: "Payment" })).toBeInTheDocument());
}

describe("CheckoutView as a guest", () => {
  beforeEach(() => {
    calls = [];
    window.localStorage.clear();
    window.localStorage.setItem("nx.guest-token", TOKEN);
    useSession.getState().set(null);
  });
  afterEach(() => window.localStorage.clear());

  it("asks for an email it can actually send the receipt to", async () => {
    renderView();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument());

    const email = screen.getByLabelText("Email");
    expect(email).not.toHaveAttribute("readonly");
    expect(screen.getByText(/no account needed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login?next=%2Fcheckout",
    );
  });

  it("does not wait on an address book it cannot have", async () => {
    const user = userEvent.setup();
    renderView();
    await fillGuestDetails(user);
    expect(calls.some((call) => call.path === "/api/v1/addresses")).toBe(false);
  });

  it("places the order with the email and the typed destination", async () => {
    const user = userEvent.setup();
    renderView();
    await fillGuestDetails(user);

    await user.click(screen.getByRole("button", { name: /^pay /i }));

    await waitFor(() =>
      expect(calls.find((call) => call.path === "/api/v1/cart/checkout")).toBeTruthy(),
    );
    const body = calls.find((call) => call.path === "/api/v1/cart/checkout")!.body!;
    expect(body.email).toBe("ada@example.test");
    expect(body.orderItems).toEqual([]);
    expect(body.addressId).toBeUndefined();
    expect(body.shipping).toMatchObject({
      recipientName: "Ada Sharma",
      line1: "1 MG Road",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411001",
      phone: "9876543210",
      country: "IN",
    });
  });

  it("puts the session credential on the order", async () => {
    const user = userEvent.setup();
    renderView();
    await fillGuestDetails(user);
    await user.click(screen.getByRole("button", { name: /^pay /i }));

    await waitFor(() =>
      expect(calls.find((call) => call.path === "/api/v1/cart/checkout")?.guest).toBe(TOKEN),
    );
  });

  it("offers the guest receipt instead of an account order page", async () => {
    const user = userEvent.setup();
    renderView();
    await fillGuestDetails(user);
    await user.click(screen.getByRole("button", { name: /^pay /i }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /view order/i })).toHaveAttribute(
        "href",
        "/checkout/done/58",
      ),
    );
  });
});

describe("CheckoutView as a signed-in shopper", () => {
  beforeEach(() => {
    calls = [];
    window.localStorage.clear();
    useSession.getState().set(signedInJwt());
  });

  it("picks a saved address and places the order with its id", async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument());

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("readonly");
    expect(email).toHaveValue("shopper@nexus.test");

    await user.click(screen.getByRole("button", { name: /continue to delivery/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Delivery address" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Payment" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^pay /i }));

    await waitFor(() =>
      expect(calls.find((call) => call.path === "/api/v1/cart/checkout")).toBeTruthy(),
    );
    const body = calls.find((call) => call.path === "/api/v1/cart/checkout")!.body!;
    expect(body.addressId).toBe(7);
    expect(body.shipping).toBeUndefined();
    expect(screen.getByRole("link", { name: /view order/i })).toHaveAttribute("href", "/orders/58");
  });
});
