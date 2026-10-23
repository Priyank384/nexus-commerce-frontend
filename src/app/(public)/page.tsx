import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/catalog/product-card";
import { getCategoryTree, searchProducts, toFacetRoots } from "@/lib/catalog/server";

export const metadata = {
  title: { absolute: "Plain Thread — considered wardrobe staples" },
};

const PROMISES = [
  {
    title: "Natural fibres only",
    body: "Organic cotton, linen, wool and cashmere. No polyester blends hiding in a 'cotton' tee.",
  },
  {
    title: "Made to be repaired",
    body: "Every seam is finished so a tailor can get to it. Tell us what tore and we will fix it.",
  },
  {
    title: "Two seasons a year",
    body: "Nothing is discontinued to make room for a drop. The crew tee has been the same since day one.",
  },
];

/**
 * `cacheComponents` prerenders everything it can, so any uncached read has to sit behind a
 * boundary. The hero is deliberately data-free: it is the LCP element, and waiting on the
 * category tree before painting it would cost the whole page its first frame.
 */
function Hero() {
  return (
    <section className="relative -mx-[clamp(1.25rem,4vw,3.5rem)]">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted sm:aspect-[16/9]">
        <Image
          src="https://picsum.photos/seed/pt-hero-2026/1800/1012?grayscale"
          alt="Plain Thread autumn collection"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* The type sits on a photograph, so it needs its own contrast layer rather than the
            theme's foreground colour. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
        />
      </div>
      <div className="shell-x absolute inset-x-0 bottom-8 flex flex-col gap-4 text-white md:bottom-14">
        <h1 className="max-w-xl text-3xl leading-tight md:text-5xl">
          Considered staples, cut to outlast the season.
        </h1>
        <p className="max-w-md text-sm opacity-90 md:text-base">
          Organic cotton, natural dyes and a size range that fits. Made in India, priced without the
          theatre.
        </p>
        <div className="mt-2">
          <Link
            href="/products"
            className={cn(buttonVariants({ size: "lg" }), "h-11 bg-white px-6 text-black hover:bg-white/85")}
          >
            Shop the collection
          </Link>
        </div>
      </div>
    </section>
  );
}

function DepartmentsSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="aspect-[4/5] w-full" />
    </div>
  );
}

async function Departments() {
  const departments = toFacetRoots(await getCategoryTree());
  if (!departments.length) return null;

  return (
    <section aria-labelledby="departments-heading" className="grid gap-8 md:grid-cols-2">
      <h2 id="departments-heading" className="sr-only">
        Departments
      </h2>
      {departments.map((department) => (
        <div key={department.slug} className="space-y-5">
          <Link
            href={`/products?category=${department.slug}`}
            className="group relative block aspect-[4/5] overflow-hidden bg-muted"
          >
            <Image
              src={`https://picsum.photos/seed/pt-dept-${department.slug}/1000/1250?grayscale`}
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent"
            />
            <span className="absolute bottom-5 left-5 text-lg text-white">{department.name}</span>
          </Link>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {department.children.map((child) => (
              <li key={child.slug}>
                <Link
                  href={`/products?category=${child.slug}`}
                  className="hover:text-foreground hover:underline hover:underline-offset-4"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function NewInSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/5] w-full" />
      ))}
    </div>
  );
}

async function NewIn() {
  const newest = await searchProducts({ sort: "createdAt,desc", size: 4, page: 0 });
  if (!newest.content.length) return null;

  return (
    <section aria-labelledby="new-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="new-heading" className="text-2xl md:text-3xl">
          New in
        </h2>
        <Link
          href="/products?sort=createdAt%2Cdesc"
          className="label-caps text-muted-foreground hover:text-foreground"
        >
          See all
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
        {newest.content.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index === 0} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-24">
      <Hero />
      <Suspense fallback={<DepartmentsSkeleton />}>
        <Departments />
      </Suspense>
      <section aria-labelledby="promises-heading" className="border-y py-14">
        <h2 id="promises-heading" className="sr-only">
          How we make clothes
        </h2>
        <dl className="grid gap-8 sm:grid-cols-3">
          {PROMISES.map((promise) => (
            <div key={promise.title}>
              <dt className="label-caps">{promise.title}</dt>
              <dd className="mt-2 text-sm leading-6 text-muted-foreground">{promise.body}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Suspense fallback={<NewInSkeleton />}>
        <NewIn />
      </Suspense>
    </div>
  );
}
