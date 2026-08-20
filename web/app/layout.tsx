import "./globals.css";
import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Backdrop } from "@/components/backdrop";
import { Nav } from "@/components/nav";
import { WalletProvider } from "@/components/wallet";
import { ToastProvider } from "@/components/toast";
import { chainInfo } from "@/lib/chain";
import { activeChainId } from "@/lib/active-chain";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const chainId = await activeChainId();
  const info = chainInfo(chainId);

  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint so neither theme flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("aval-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}else if(matchMedia("(prefers-color-scheme: light)").matches){document.documentElement.dataset.theme="light"}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <ToastProvider>
        <WalletProvider>
          <SmoothScroll />
          <Backdrop />
          <Nav chainId={chainId} />
          <main className="mx-auto max-w-6xl px-6 pb-32">{children}</main>
          <footer className="mx-auto max-w-6xl px-6 pb-16">
            <div className="rule mb-7" />
            <div className="flex flex-wrap items-start justify-between gap-8">
              <p className="max-w-[52ch] text-[13px] leading-relaxed text-ink-faint">
                A documentary credit for autonomous agents. Every figure on this site is read from
                the chain when the page renders.
              </p>
              <div className="font-mono text-[11px] tracking-[0.14em] text-ink-faint uppercase">
                {info.name} · chain {chainId}
              </div>
            </div>
          </footer>
        </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
