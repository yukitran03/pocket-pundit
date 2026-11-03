import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { Dashboard } from "@/components/me/Dashboard";
import { TokenHelp } from "@/components/me/TokenHelp";

export const metadata: Metadata = {
  title: "Your dashboard",
  description: `Your picks, what ${BRAND.name} has learned about your taste, and every memory it keeps on Walrus.`,
  robots: { index: false, follow: false },
  // The token lives in the query string: never leak it to explorers via Referer.
  referrer: "no-referrer",
};

export default async function MePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).t;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!token) return <TokenHelp reason="missing" />;
  return <Dashboard token={token} />;
}
