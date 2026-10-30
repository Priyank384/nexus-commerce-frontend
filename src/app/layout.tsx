import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

// The variable names are load-bearing: @theme inline maps Tailwind's font-sans and
// font-heading utilities onto these, so a different name silently drops the typeface.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-heading",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute URLs for canonicals, OG images and the sitemap all resolve against this.
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — considered wardrobe staples`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Deliberately no generic `index`/`follow` here: indexing is already the default, and
  // Next tags every 404 with `noindex` — an explicit root directive would ship a second,
  // conflicting robots tag on not-found responses. Only the Googlebot preview opt-in remains.
  robots: {
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // next-themes rewrites class="dark" before hydration, so the attribute
      // legitimately disagrees with the server HTML for dark-preference visitors.
      suppressHydrationWarning
      className={`${geistSans.variable} ${interTight.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:ring-1 focus:ring-border"
          >
            Skip to content
          </a>
          <SiteHeader />
          {/* tabIndex -1 lets the skip link move focus here without adding the main
              region to the tab order. */}
          <main id="content" tabIndex={-1} className="shell-x flex-1 py-10 outline-none">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
