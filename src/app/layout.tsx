import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
  title: {
    default: "Plain Thread",
    template: "%s · Plain Thread",
  },
  description:
    "Considered wardrobe staples in natural fibres — menswear and womenswear made to be worn for years.",
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
          <SiteHeader />
          <main className="shell-x flex-1 py-10">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
