"use client";

import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "motion/react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConnectButton } from "./wallet";
import { ThemeToggle } from "./theme-toggle";
import { ChainSwitcher } from "./chain-switcher";
import { Mark } from "./mark";
import type { ChainId } from "@/lib/chain";

const LINKS = [
  { href: "/", label: "Credits" },
  { href: "/issue", label: "Issue" },
  { href: "/erc8004", label: "ERC-8004" },
  { href: "/docs", label: "Docs" },
];

export function Nav({ chainId }: { chainId: ChainId }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  // Reading progress, sprung so it glides, a document you are working through.
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });
  // Opacity-only animation so the glass itself is painted with theme tokens.
  const solidity = useTransform(scrollY, [0, 120], [0, 1]);

  // Navigating closes the menu; so does resizing up to desktop.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50">
      <motion.div
        style={{ opacity: solidity }}
        className="absolute inset-0 border-b border-rule bg-stock-900/85 backdrop-blur-xl"
      />
      <div className="relative mx-auto flex max-w-[1180px] items-center gap-x-8 px-6 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <Mark className="size-[22px] shrink-0 transition-transform duration-500 group-hover:rotate-180" />
          <span className="font-display text-[19px] leading-none tracking-[0.26em] text-ink">
            AVAL
          </span>
        </Link>

        {/* desktop register */}
        <span className="hidden h-5 w-px bg-rule md:block" />
        <nav className="hidden items-center gap-x-6 md:flex">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`group relative py-1 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors ${
                isActive(href) ? "text-brass" : "text-ink-dim hover:text-ink"
              }`}
            >
              {label}
              <span
                className={`absolute -bottom-0.5 left-0 h-px bg-brass transition-all duration-300 ${
                  isActive(href) ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden lg:flex">
            <ChainSwitcher current={chainId} />
          </span>
          <ThemeToggle />
          <span className="hidden md:block">
            <ConnectButton chainId={chainId} />
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-8 items-center justify-center border border-rule text-ink-dim transition-colors hover:border-rule-bright hover:text-ink md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* phone menu: a full sheet under the header */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full h-[calc(100vh-100%)] border-t border-rule bg-stock-900/97 backdrop-blur-xl md:hidden"
          >
            <div className="flex h-full flex-col px-6 py-8">
              <nav className="space-y-1">
                {LINKS.map(({ href, label }, i) => (
                  <motion.div
                    key={href}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}
                  >
                    <Link
                      href={href}
                      className={`block border-l-2 py-3.5 pl-5 font-display text-[26px] leading-none transition-colors ${
                        isActive(href)
                          ? "border-brass text-brass"
                          : "border-rule text-ink hover:border-rule-bright"
                      }`}
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <div className="mt-auto space-y-5 border-t border-rule pt-6">
                <ChainSwitcher current={chainId} />
                <ConnectButton chainId={chainId} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        style={{ scaleX: progress }}
        className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-gradient-to-r from-brass-deep via-brass to-brass-soft"
      />
    </header>
  );
}
