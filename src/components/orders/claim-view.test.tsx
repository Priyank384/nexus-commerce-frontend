import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { replace, search } = vi.hoisted(() => ({
  replace: vi.fn(),
  // The token arrives in the query string, so the mock answers exactly that one parameter.
  search: { current: "" },
}));

const TOKEN = "a-claim-token-from-the-receipt-email";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => (key === "token" ? search.current : null) }),
}));

const ORDER = {
  id: 41,
  userId: 8,
  customerName: "Asha Rao",
  customerEmail: "asha@nexus.test",
  orderStatus: "PENDING",
  totalPrice: 2499,
  paymentStatus: "PAID",
  paidAt: "2026-03-02T09:14:00Z",
  address: null,
  createdAt: "2026-03-02T09:12:00Z",
  updatedAt: "2026-03-02T09:14:00Z",
  items: [
    {
      id: 91,
      productId: 1101,
      productName: "Organic Cotton Crew Tee",
      quantity: 1,
      unitPrice: 2499,
      variantSize: "M",
      variantColorName: "Sand",
    },
  ],
};

let posts: Record<string, unknown>[] = [];
let claimStatus = 200;

// The API client is built on a same-origin relative baseUrl, which undici cannot parse, so this
// answers fetch directly — the reason the other component tests of mutation flows do too.
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const path = new URL(request.url).pathname;

    if (path === "/api/auth/refresh") return Response.json({ success: false }, { status: 401 });

    if (path === "/api/v1/orders/claim" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown>;
      posts.push(body);
      return Response.json(
        claimStatus === 200
          ? { success: true, message: "Order claimed", error: null, data: ORDER }
          : {
              success: false,
              message: "Resource Not Found!",
              error: "That claim link is not valid, has already been used, or belongs to a deleted order",
              data: null,
            },
        { status: claimStatus },
      );
    }

    return Response.json({ success: true, message: "ok", error: null, data: null });
  }),
);

const { ClaimView } = await import("@/components/orders/claim-view");

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ClaimView />
    </QueryClientProvider>,
  );
}

describe("ClaimView", () => {
  beforeEach(() => {
    posts = [];
    claimStatus = 200;
    search.current = TOKEN;
    replace.mockClear();
  });

  it("claims the order the link names and shows what moved", async () => {
    renderView();
    await userEvent.click(screen.getByRole("button", { name: /claim this order/i }));

    await screen.findByText("This order is yours now");
    expect(posts).toEqual([{ claimToken: TOKEN }]);
    expect(screen.getByText("#41")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view the order/i })).toHaveAttribute(
      "href",
      "/orders/41",
    );
    // The spent token must not stay in the address bar for a reload to trip over.
    expect(replace).toHaveBeenCalledWith("/orders/claim");
  });

  it("waits for a press before it spends a one-time link", async () => {
    renderView();

    await screen.findByRole("button", { name: /claim this order/i });
    // Claiming attaches the order and retires the link, so opening an email out of curiosity
    // cannot be the thing that hands the order over.
    expect(posts).toHaveLength(0);
  });

  it("answers a spent or unknown link with the store's own reason", async () => {
    claimStatus = 404;
    renderView();
    await userEvent.click(screen.getByRole("button", { name: /claim this order/i }));

    await screen.findByText("This link will not claim an order");
    expect(
      screen.getByText(
        "That claim link is not valid, has already been used, or belongs to a deleted order",
      ),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("explains the email link when the address carries no token", async () => {
    search.current = "";
    renderView();

    await waitFor(() =>
      expect(screen.getByText("Claim an order", { selector: "h1" })).toBeInTheDocument(),
    );
    expect(posts).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /claim this order/i })).not.toBeInTheDocument();
  });
});
