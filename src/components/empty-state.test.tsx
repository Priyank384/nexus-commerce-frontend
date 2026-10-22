import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/empty-state";

// next/link needs a router context that unit tests do not have; the href is the
// only part of it EmptyState cares about.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("EmptyState", () => {
  it("renders a call to action when one is supplied", () => {
    render(
      <EmptyState
        title="Your bag is empty"
        description="Add something and it will show up here."
        action={{ label: "Shop the catalogue", href: "/products" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Your bag is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop the catalogue" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("leaves the action out when there is nowhere to send the user", () => {
    render(<EmptyState title="No reviews yet" description="Be the first to write one." />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
