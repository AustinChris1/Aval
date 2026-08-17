"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Ban,
  CircleCheck,
  FileSignature,
  Gavel,
  Landmark,
  ScrollText,
  Send,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Row = {
  kind: string;
  title: string;
  detail: string;
  hash: string;
  blockNumber: string;
  refused?: boolean;
  error?: string;
};

const ICONS: Record<string, LucideIcon> = {
  issued: ScrollText,
  paid: Send,
  executed: Send,
  refused: Ban,
  presented: FileSignature,
  examined: CircleCheck,
  drawn: Landmark,
  disputed: Gavel,
  resolved: Gavel,
  refunded: Undo2,
};

export function Timeline({ rows, txBase }: { rows: Row[]; txBase: string }) {
  const reduced = useReducedMotion();

  return (
    <ol className="relative mt-7 space-y-3">
      {/* the spine */}
      <div className="absolute top-3 bottom-3 left-[19px] w-px bg-gradient-to-b from-transparent via-line-bright to-transparent" />

      {rows.map((r, i) => {
        const Icon = ICONS[r.kind] ?? CircleCheck;
        const refused = Boolean(r.refused);

        return (
          <motion.li
            key={`${r.hash}-${r.kind}-${i}`}
            className="relative flex gap-4 pl-0"
            initial={reduced ? undefined : { opacity: 0, x: -10 }}
            whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
          >
            {/* node */}
            <div
              className={`relative z-10 mt-3 flex size-10 shrink-0 items-center justify-center rounded-full border ${
                refused
                  ? "border-seal-deep bg-seal-bg text-seal"
                  : "border-line bg-ink-800 text-parchment-dim"
              }`}
            >
              <Icon className={`size-4 ${refused ? "animate-pulse-seal" : ""}`} />
            </div>

            {/* card */}
            <div
              className={`min-w-0 flex-1 rounded-xl border p-4 backdrop-blur-sm transition-colors duration-300 ${
                refused
                  ? "border-seal-deep bg-seal-bg/70 hover:border-seal/50"
                  : "border-line bg-ink-800/70 hover:border-line-bright"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span
                  className={`text-[14.5px] font-semibold ${refused ? "text-seal" : "text-parchment"}`}
                >
                  {r.title}
                </span>
                <a
                  href={`${txBase}/tx/${r.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex shrink-0 items-center gap-1 font-mono text-[11.5px] text-parchment-faint transition-colors hover:text-ledger"
                >
                  {r.hash.slice(0, 10)}…{r.hash.slice(-6)}
                  <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>

              <div className="mt-1.5 font-mono text-[12.5px] break-all text-parchment-faint">
                {r.detail}
              </div>

              {r.error && (
                <div className="mt-3 rounded-lg border border-seal-deep bg-ink-950/60 px-3 py-2 font-mono text-[12px] break-all text-seal">
                  reverted with {r.error}
                </div>
              )}

              <div className="mt-2 font-mono text-[11px] text-parchment-faint/70">
                block {r.blockNumber}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
