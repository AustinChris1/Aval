import "./globals.css";
import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Backdrop } from "@/components/backdrop";
import { Nav } from "@/components/nav";
import { WalletProvider } from "@/components/wallet";
import { DEFAULT_CHAIN_ID, chainInfo } from "@/lib/chain";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "AVAL — documentary credit for AI agents",
  description:
    "Lock money against a job, an agent, a rulebook and an examiner. The agent cannot spend outside the rulebook, and cannot be paid without documents someone actually checked.",
  openGraph: {
    title: "AVAL — documentary credit for AI agents",
    description:
      "The agent never holds the money. A forbidden payment is a mined revert, not a log you read afterwards.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const info = chainInfo(DEFAULT_CHAIN_ID);

  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <WalletProvider>
          <SmoothScroll />
          <Backdrop />
          <Nav chainId={DEFAULT_CHAIN_ID} chainLabel={`${info.name.replace("BOT Chain ", "")} · ${DEFAULT_CHAIN_ID}`} />
          <main className="mx-auto max-w-6xl px-6 pb-32">{children}</main>
          <footer className="mx-auto max-w-6xl px-6 pb-16">
            <div className="rule mb-7" />
            <div className="flex flex-wrap items-start justify-between gap-8">
              <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-faint">
                AVAL is a documentary credit for autonomous agents, built for the BOT Chain Builder
                Challenge #2. An aval is a guarantee endorsed onto a bill of exchange — a third
                party standing behind the instrument. Identity, examination and reputation use ERC-8004. Every figure on this
                site is read from the chain when the page renders — nothing is cached in a database,
                and nothing is asserted by this page that you cannot check yourself.
              </p>
              <div className="font-mono text-[11px] tracking-[0.14em] text-ink-faint uppercase">
                {info.name} · chain {DEFAULT_CHAIN_ID}
              </div>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
