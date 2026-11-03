import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import "./globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-big-shoulders",
  display: "swap",
  axes: ["opsz"],
  fallback: ["Arial Narrow", "system-ui", "sans-serif"],
});
const sans = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Match Finder: tonight's three matches, picked from your memory",
    template: "%s · Match Finder",
  },
  description:
    "A personal Telegram agent that picks the 3 football matches most worth your evening out of 400+ fixtures. It learns from your ratings, stores what it learned as encrypted memories on Walrus, and proves ownership on Sui mainnet.",
  applicationName: "Match Finder",
  keywords: ["football", "Telegram bot", "Walrus", "Sui", "Tatum", "agent memory", "personalisation"],
  openGraph: {
    type: "website",
    siteName: "Match Finder",
    title: "Match Finder: 400 fixtures tonight, three worth your evening",
    description: "A football agent with a memory you own. It learns from every rating, stores memories on Walrus and proves it on Sui mainnet.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#060e0b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[10px] focus:bg-flare focus:px-4 focus:py-2 focus:text-flare-ink"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
