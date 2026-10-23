"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS, isAdminSection } from "@/lib/admin/sections";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-14">
      <aside className="lg:w-44 lg:shrink-0 lg:border-r lg:border-border/70 lg:pr-8">
        <div className="flex items-baseline justify-between gap-4 lg:block">
          <p className="label-caps text-muted-foreground">Admin console</p>
          <Link
            href="/"
            className="label-caps text-muted-foreground underline-offset-4 hover:text-foreground hover:underline lg:mt-6 lg:inline-block"
          >
            ← Store
          </Link>
        </div>
        <nav
          aria-label="Admin sections"
          className="mt-4 flex flex-wrap gap-x-6 gap-y-3 lg:mt-8 lg:flex-col lg:flex-nowrap lg:gap-4"
        >
          {ADMIN_SECTIONS.map((section) => {
            const active = isAdminSection(pathname, section.href);
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "label-caps transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
