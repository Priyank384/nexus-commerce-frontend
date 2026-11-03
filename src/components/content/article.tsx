import Link from "next/link";
import type { ReactNode } from "react";
import { POLICY_LAST_UPDATED } from "@/lib/content/policy";

/**
 * Typographic shell for the policy pages, so four documents read as one set of pages rather than
 * four essays written on four different days. Kept to server components with plain markup: these
 * pages have no interactivity to test and no data to fetch, which is exactly why they can be
 * prerendered and crawled.
 */
export function Article({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <p className="label-caps text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">{title}</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{summary}</p>
      <div className="mt-12 space-y-12">{children}</div>
      <p className="mt-12 border-t pt-4 text-xs text-muted-foreground">
        Last updated {POLICY_LAST_UPDATED}
      </p>
    </article>
  );
}

/**
 * A heading the page can be linked to. Every section gets an id so the storefront can point a
 * shopper at the one paragraph they need — the checkout error copy does this rather than dumping
 * them at the top of a long page.
 */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-foreground/90">{children}</p>;
}

/**
 * The honest-exception callout. A policy page is where a store states what it cannot do, and that
 * deserves a box rather than a sentence buried between two paragraphs a shopper skims past.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm leading-6">
      {children}
    </aside>
  );
}

export function BulletList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-muted-foreground/60">{children}</ul>
  );
}

export function Bullet({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

/** A definition row: the term the shopper is scanning for, then what it means here. */
export function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-t pt-3">
      <dt className="label-caps text-foreground">{term}</dt>
      <dd className="mt-1.5 text-sm leading-6 text-muted-foreground">{children}</dd>
    </div>
  );
}

/** Where to go next. Internal links only — every destination here has to be a page that exists. */
export function Destinations({ links }: { links: { href: string; label: string; note: string }[] }) {
  return (
    <nav aria-label="Related pages" className="grid gap-3 sm:grid-cols-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-lg border p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <span className="block text-sm font-medium">{link.label}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{link.note}</span>
        </Link>
      ))}
    </nav>
  );
}
