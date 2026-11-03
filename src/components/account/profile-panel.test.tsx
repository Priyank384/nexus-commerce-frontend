import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The panel embeds the password form, which routes on success; nothing here exercises that.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const PROFILE = {
  id: 12,
  name: "Aditi Rao",
  email: "aditi@nexus.test",
  phone: "9812345678",
  role: "USER",
  createdAt: "2026-02-11T10:00:00Z",
};

type Body = Record<string, string> | null;
type Call = { path: string; method: string; body: Body };

let calls: Call[] = [];
let patchStatus = 200;

// What the store holds between calls, so a refetch after a save answers with the saved row
// rather than the one the test started from.
let stored = { ...PROFILE };

// The API client is built on a same-origin relative baseUrl, which undici cannot parse, so this
// answers fetch directly — the same reason guest-receipt.test.tsx does not use the MSW server.
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const path = new URL(request.url).pathname;
    const body =
      request.method === "GET" || request.method === "HEAD" || !request.body
        ? null
        : ((await request.json().catch(() => null)) as Body);
    calls.push({ path, method: request.method, body });

    if (path === "/api/auth/refresh") return Response.json({ success: false }, { status: 401 });

    if (path === "/api/v1/users/me" && request.method === "PATCH") {
      const saved = (body ?? {}) as Record<string, string>;
      return Response.json(
        patchStatus === 200
          ? {
              success: true,
              message: "Profile updated",
              error: null,
              data: (stored = { ...stored, name: saved.name, phone: saved.phone ?? null }),
            }
          : {
              success: false,
              message: "Invalid request!",
              error: "Name must not be blank",
              data: null,
            },
        { status: patchStatus },
      );
    }

    if (path === "/api/v1/users/me") {
      return Response.json({ success: true, message: "Profile fetched", error: null, data: stored });
    }

    return Response.json({ success: true, message: "ok", error: null, data: null });
  }),
);

const { ProfilePanel } = await import("@/components/account/profile-panel");

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfilePanel />
    </QueryClientProvider>,
  );
}

function patches() {
  return calls.filter((call) => call.method === "PATCH").map((call) => call.body);
}

async function saveAs(name: string, phone?: string) {
  await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
  const nameField = await screen.findByLabelText(/^Name$/i);
  await userEvent.clear(nameField);
  // user-event rejects an empty string, and clearing is exactly what these cases mean.
  if (name) await userEvent.type(nameField, name);
  if (phone !== undefined) {
    const phoneField = screen.getByLabelText(/Phone/i);
    await userEvent.clear(phoneField);
    if (phone) await userEvent.type(phoneField, phone);
  }
  await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
}

describe("ProfilePanel", () => {
  beforeEach(() => {
    calls = [];
    patchStatus = 200;
    stored = { ...PROFILE };
  });

  it("saves a new name and shows it without a reload", async () => {
    renderPanel();
    await screen.findByText("Aditi Rao");

    await saveAs("Aditi Sharma");

    await waitFor(() => expect(screen.getByText("Aditi Sharma")).toBeInTheDocument());
    expect(patches()).toEqual([{ name: "Aditi Sharma", phone: "9812345678" }]);
    // Back to the read view, so the shopper can see what the account now says.
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("clears the number upstream rather than sending an empty one", async () => {
    renderPanel();
    await screen.findByText("Aditi Rao");

    await saveAs("Aditi Rao", "");

    await waitFor(() => expect(patches()).toHaveLength(1));
    // An empty string is not how the DTO is asked to forget the column; leaving it out is.
    expect(patches()[0]).toEqual({ name: "Aditi Rao" });
    await waitFor(() => expect(screen.getByText("Not given")).toBeInTheDocument());
  });

  it("keeps a name the browser knows is empty off the wire", async () => {
    renderPanel();
    await screen.findByText("Aditi Rao");

    await saveAs("");

    await waitFor(() => expect(screen.getByText("Name is required")).toBeInTheDocument());
    expect(patches()).toHaveLength(0);
  });

  it("leaves the typed name in the field when the store refuses it", async () => {
    patchStatus = 400;
    renderPanel();
    await screen.findByText("Aditi Rao");

    await saveAs("Aditi Sharma");

    await waitFor(() => expect(patches()).toHaveLength(1));
    // Closing the form on a rejected save would throw away what the shopper typed and their only
    // clue about it, so the fields stay put with the server's reason beside them.
    expect(screen.getByLabelText(/^Name$/i)).toHaveValue("Aditi Sharma");
  });
});
