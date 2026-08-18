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
    <ol className="relative mt-8 space-y-3">
      <div className="absolute top-4 bottom-4 left-[21px] w-px bg-gradient-to-b from-transparent via-rule-bright to-transparent" />

      {rows.map((r, i) => {
        const Icon = ICONS[r.kind] ?? CircleCheck;
        const refused = Boolean(r.refused);

        return (
          <motion.li
            key={`${r.hash}-${r.kind}-${i}`}
            className="relative flex gap-4"
            initial={reduced ? undefined : { opacity: 0, x: -12 }}
            whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.05 }}
            transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className={`relative z-10 mt-3 flex size-11 shrink-0 items-center justify-center rounded-full border ${
                refused
                  ? "border-seal-deep bg-seal-bg text-seal"
                  : "border-rule bg-stock-800 text-ink-dim"
              }`}
            >
              {refused && <span className="absolute inset-0 animate-seal rounded-full bg-seal/10" />}
              <Icon className="size-4" />
            </div>

            <div
              className={`min-w-0 flex-1 rounded-xl border p-4 backdrop-blur-[2px] transition-colors duration-300 ${
                refused
                  ? "border-seal-deep bg-seal-bg/60 hover:border-seal/60"
                  : "border-rule bg-stock-800/60 hover:border-rule-bright"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className={`text-[14.5px] font-semibold ${refused ? "text-seal" : "text-ink"}`}>
                  {r.title}
                </span>
                <a
                  href={`${txBase}/tx/${r.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex shrink-0 items-center gap-1 font-mono text-[11.5px] text-ink-faint transition-colors hover:text-verd"
                >
                  {r.hash.slice(0, 10)}…{r.hash.slice(-6)}
                  <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>

              <div className="mt-1.5 font-mono text-[12.5px] break-all text-ink-faint">{r.detail}</div>

              {r.error && (
                <div className="mt-3 rounded-lg border border-seal-deep bg-stock-950/70 px-3 py-2 font-mono text-[12px] break-all text-seal">
                  reverted with {r.error}
                </div>
              )}

              <div className="mt-2 font-mono text-[11px] text-ink-faint/70">block {r.blockNumber}</div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
