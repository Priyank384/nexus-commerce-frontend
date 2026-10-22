import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

// The variable name has to be --font-sans: globals.css maps Tailwind's font-sans
// utility onto it, so anything else silently leaves the body on Tailwind's default.
const geistSans = Geist({
  variable: "--font-sans",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
