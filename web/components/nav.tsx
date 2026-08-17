"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { FileText, ScrollText, ShieldAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const LINKS = [
  { href: "/", label: "Letters", icon: ScrollText },
  { href: "/erc8004", label: "ERC-8004 on BOT Chain", icon: ShieldAlert },
];

export function Nav({ chainLabel }: { chainLabel: string }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  // The header tightens and gains a border as you leave the hero.
  const blur = useTransform(scrollY, [0, 120], [0, 14]);
  const border = useTransform(scrollY, [0, 120], ["rgba(35,41,50,0)", "rgba(35,41,50,1)"]);
  const bg = useTransform(scrollY, [0, 120], ["rgba(11,13,16,0)", "rgba(11,13,16,0.82)"]);

  return (
    <motion.header
      style={{ backdropFilter: useTransform(blur, (b) => `blur(${b}px)`), borderColor: border, background: bg }}
      className="sticky top-0 z-50 border-b"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3.5">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <FileText className="size-4 translate-y-0.5 text-ledger transition-transform group-hover:-rotate-6" />
          <span className="text-[15px] font-semibold tracking-[0.14em] text-parchment uppercase">
            Letter
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-[13px]">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`group relative inline-flex items-center gap-1.5 py-1 transition-colors ${
                  active ? "text-parchment" : "text-parchment-faint hover:text-parchment"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-px bg-ledger transition-all duration-300 ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-pulse-seal rounded-full bg-ledger" />
            <span className="relative inline-flex size-1.5 rounded-full bg-ledger" />
          </span>
          <span className="font-mono text-[11px] tracking-[0.08em] text-parchment-faint uppercase">
            {chainLabel}
          </span>
        </div>
      </div>
    </motion.header>
  );
}
