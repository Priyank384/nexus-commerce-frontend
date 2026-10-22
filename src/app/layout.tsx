import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexusCommerce",
  description: "Spring Boot + Next.js commerce demo",
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
          <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">{children}</main>
          <footer className="border-t py-4 text-center text-xs text-muted-foreground">
            NexusCommerce · Spring Boot backend · Next.js frontend
          </footer>
        </Providers>
      </body>
    </html>
  );
}
