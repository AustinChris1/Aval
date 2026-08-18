"use client";

import { AnimatePresence, motion } from "motion/react";
import { BookOpen, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Doc = { slug: string; title: string; blurb: string };

/**
 * The docs switcher: pages change without scrolling anywhere.
 *
 * Desktop gets a sticky sidebar beside the article. Phones get a floating
 * button (bottom-left, clear of the toast stack) that opens a slide-up sheet —
 * always reachable no matter how deep into a document the reader is.
 */
export function DocsNav({ docs, current }: { docs: readonly Doc[]; current: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the sheet.
  useEffect(() => setOpen(false), [pathname]);

  const list = (dense: boolean) => (
    <nav className="space-y-1">
      {docs.map((d) => {
        const active = d.slug === current;
        return (
          <Link
            key={d.slug}
            href={`/docs/${d.slug}`}
            className={`block border-l-2 py-2 pr-3 pl-4 transition-colors ${
              active
                ? "border-brass bg-brass/5 text-ink"
                : "border-rule text-ink-dim hover:border-rule-bright hover:text-ink"
            }`}
          >
            <span className="block font-mono text-[11px] tracking-[0.12em] uppercase">{d.title}</span>
            {!dense && (
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">{d.blurb}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* desktop: sticky beside the article */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <div className="mb-3 font-mono text-[10px] tracking-[0.2em] text-brass/70 uppercase">
            documentation
          </div>
          {list(false)}
        </div>
      </aside>

      {/* phone: floating button + slide-up sheet */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open the documentation menu"
        className="btn-brass fixed bottom-4 left-4 z-[90] inline-flex items-center gap-2 rounded-sm px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.14em] uppercase lg:hidden"
      >
        <BookOpen className="size-3.5" />
        Docs
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[95] bg-stock-950/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="sheet-depth fixed inset-x-0 bottom-0 z-[96] border-t border-rule p-5 pb-8 lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-brass/70 uppercase">
                  documentation
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-ink-faint hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
              {list(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
