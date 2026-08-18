"use client";

import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "./wallet";
import { Mark } from "./mark";
import type { ChainId } from "@/lib/chain";

const LINKS = [
  { href: "/", label: "Credits" },
  { href: "/issue", label: "Issue" },
  { href: "/erc8004", label: "ERC-8004" },
  { href: "/docs", label: "Docs" },
];

export function Nav({ chainId, chainLabel }: { chainId: ChainId; chainLabel: string }) {
  const pathname = usePathname();
  const { scrollY, scrollYProgress } = useScroll();
  // Reading progress, sprung so it glides — a document you are working through.
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });
  const blur = useTransform(scrollY, [0, 120], [0, 16]);
  const border = useTransform(scrollY, [0, 120], ["rgba(38,48,73,0)", "rgba(38,48,73,1)"]);
  const bg = useTransform(scrollY, [0, 120], ["rgba(10,13,24,0)", "rgba(10,13,24,0.88)"]);

  return (
    <motion.header
      style={{
        backdropFilter: useTransform(blur, (b) => `blur(${b}px)`),
        borderColor: border,
        background: bg,
      }}
      className="sticky top-0 z-50 border-b"
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <Mark className="size-[22px] shrink-0 transition-transform duration-500 group-hover:rotate-180" />
          <span className="font-display text-[19px] leading-none tracking-[0.26em] text-ink">
            AVAL
          </span>
        </Link>

        {/* a hairline separating the mark from the register, as on a letterhead */}
        <span className="hidden h-5 w-px bg-rule sm:block" />

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`group relative py-1 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors ${
                  active ? "text-brass" : "text-ink-dim hover:text-ink"
                }`}
              >
                {label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-px bg-brass transition-all duration-300 ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden items-center gap-2 md:flex">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-seal rounded-full bg-verd" />
              <span className="relative inline-flex size-1.5 rounded-full bg-verd" />
            </span>
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink-faint uppercase">
              {chainLabel}
            </span>
          </span>
          <ConnectButton chainId={chainId} />
        </div>
      </div>
      <motion.div
        style={{ scaleX: progress }}
        className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-gradient-to-r from-brass-deep via-brass to-brass-soft"
      />
    </motion.header>
  );
}
