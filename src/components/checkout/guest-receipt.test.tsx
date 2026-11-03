import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

const TOKEN = "kQ7mZ2xT9vB4cL6pR8sY1uW3eA5nJ0hD7gF2kM9qXbE";

let status: Record<string, unknown> = {};
let checkoutStatus = 200;
let paths: string[] = [];

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const path = new URL(request.url).pathname;
    paths.push(path);
    if (path.startsWith("/api/v1/payments/orders/")) {
      return Response.json(
        checkoutStatus === 200 ? { success: true, data: status } : { success: false },
        { status: checkoutStatus },
      );
    }
    return Response.json({ success: true, data: {} });
  }),
);

const { GuestReceipt } = await import("@/components/checkout/guest-receipt");
const { useSession } = await import("@/lib/auth/session");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

let orderId = "58";

vi.mock("next/navigation", () => ({
  useParams: () => ({ orderId }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuestReceipt />
    </QueryClientProvider>,
  );
}

describe("GuestReceipt", () => {
  beforeEach(() => {
    paths = [];
    checkoutStatus = 200;
    orderId = "58";
    window.localStorage.clear();
    window.localStorage.setItem("nx.guest-token", TOKEN);
    useSession.getState().set(null);
  });

  it("confirms a captured payment and offers to keep the order", async () => {
    status = { orderId: 58, orderStatus: "PENDING", paymentStatus: "PAID", totalPrice: 2400 };
    renderView();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /thank you — it is paid/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/#58/)).toBeInTheDocument();
    expect(screen.getByText("Payment captured")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute(
      "href",
      "/register?next=%2Forders%2Fclaim",
    );
    expect(screen.queryByRole("button", { name: /^pay /i })).not.toBeInTheDocument();
  });

  it("lets an unpaid order be paid from the receipt", async () => {
    status = { orderId: 58, orderStatus: "PENDING", paymentStatus: "CREATED", totalPrice: 2400 };
    renderView();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^pay ₹2,400$/i })).toBeInTheDocument(),
    );
    expect(paths).toContain("/api/v1/payments/orders/58/status");
  });

  it("says so when the order is not this browser's", async () => {
    checkoutStatus = 404;
    renderView();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /cannot find that order/i })).toBeInTheDocument(),
    );
  });

  /**
   * A 403 is the claim link doing its job: the order left this browser's session and is on an
   * account now. Nothing a retry can undo, so the page has to say where it went and stop asking.
   */
  it("tells a claimed order's browser where the order went instead of offering a retry", async () => {
    checkoutStatus = 403;
    renderView();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /cannot find that order/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /claim with a link/i })).toBeInTheDocument();
  });

  it("stops polling once the request is rejected", async () => {
    vi.useFakeTimers();
    try {
      checkoutStatus = 403;
      renderView();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(12_000);
      });
      expect(paths.filter((path) => path.endsWith("/status"))).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("names a declined payment instead of blaming the gateway", async () => {
    status = { orderId: 58, orderStatus: "PENDING", paymentStatus: "FAILED", totalPrice: 2400 };
    renderView();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /payment did not go through/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/nothing has been charged/i)).toBeInTheDocument();
  });
});
