import Link from "next/link";

const COLUMNS = [
  {
    heading: "Shop",
    links: [
      { href: "/products", label: "All garments" },
      { href: "/products?category=men", label: "Menswear" },
      { href: "/products?category=women", label: "Womenswear" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/cart", label: "Cart" },
      { href: "/orders", label: "Orders" },
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Create an account" },
    ],
  },
];

// Server component: no session here, so the footer never blocks on the BFF
// rehydrate. Guarded routes bounce to /login on their own when clicked.
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t">
      <div className="shell-x grid gap-10 py-14 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="text-sm font-medium tracking-[0.3em] uppercase">Plain Thread</p>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Considered wardrobe staples in natural fibres, made to be worn for years rather
            than seasons.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <p className="label-caps text-muted-foreground">{column.heading}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link href={link.href} className="text-sm hover:underline underline-offset-4">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="shell-x flex flex-col gap-2 border-t py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        {/* No build-time year here: these pages prerender statically, so a
            getFullYear() would freeze whatever year the image was built in. */}
        <p>© Plain Thread</p>
        <p>Prices in INR · Payments secured by Razorpay</p>
      </div>
    </footer>
  );
}
