import "./globals.css";
import type { Metadata } from "next";
import { SmoothScroll } from "@/components/smooth-scroll";
import { LedgerField } from "@/components/ledger-field";
import { Nav } from "@/components/nav";
import { DEFAULT_CHAIN_ID, chainInfo } from "@/lib/chain";

export const metadata: Metadata = {
  title: "LETTER — documentary credit for AI agents",
  description:
    "Lock money against a job, an agent, a rulebook and an examiner. The agent cannot spend outside the rulebook, and cannot be paid without documents someone actually checked.",
  openGraph: {
    title: "LETTER — documentary credit for AI agents",
    description:
      "The agent never holds the money. A forbidden payment is a mined revert, not a log you read afterwards.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const info = chainInfo(DEFAULT_CHAIN_ID);

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SmoothScroll />
        <LedgerField />
        <Nav chainLabel={`${info.name.replace("BOT Chain ", "BOT ")} · ${DEFAULT_CHAIN_ID}`} />
        <main className="mx-auto max-w-6xl px-6 pb-32">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-14">
          <div className="rule mb-6" />
          <p className="max-w-[68ch] text-[13px] leading-relaxed text-parchment-faint">
            LETTER is a documentary credit for autonomous agents, built for the BOT Chain Builder
            Challenge #2. Identity, examination and reputation use ERC-8004. Every figure on this site
            is read from the chain at request time — nothing is cached from a database and nothing is
            asserted by this page.
          </p>
        </footer>
      </body>
    </html>
  );
}
