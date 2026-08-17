import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LETTER — documentary credit for AI agents",
  description:
    "Lock money against a job, an agent, a rulebook and an examiner. The agent cannot spend outside the rulebook, and cannot be paid without documents someone actually checked.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap">
            <div className="brand">
              <h1>LETTER</h1>
              <span className="tag">documentary credit for AI agents · BOT Chain</span>
            </div>
            <nav>
              <a href="/">Letters</a>
              <a href="/erc8004">ERC-8004 on BOT Chain</a>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
