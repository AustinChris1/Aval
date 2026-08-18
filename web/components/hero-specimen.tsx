"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";

type Tag = {
  label: string;
  value: string;
  tone?: "seal" | "brass";
  href?: string;
  /** Position, as percentages of the specimen frame. */
  x: string;
  y: string;
};

/**
 * The hero: the 1854 bill of exchange floating as a physical object, with live
 * on-chain values pinned to it like an examiner's evidence tags. The old paper
 * carries the new data — the whole product in one picture.
 */
export function HeroSpecimen({ tags }: { tags: Tag[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-7, 7]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(my, [0, 1], [5, -5]), { stiffness: 120, damping: 18 });

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }

  return (
    <div
      ref={ref}
      onMouseMove={reduced ? undefined : onMove}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      className="relative [perspective:1400px]"
    >
      <motion.div
        style={reduced ? undefined : { rotateX, rotateY }}
        initial={reduced ? undefined : { opacity: 0, y: 26, rotateZ: -1.2 }}
        animate={reduced ? undefined : { opacity: 1, y: 0, rotateZ: -1.2 }}
        transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative [transform-style:preserve-3d]"
      >
        {/* the instrument */}
        <div className="relative overflow-hidden border border-rule shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wechsel-1854.jpg"
            alt="A bill of exchange drawn in Vienna in 1854"
            className="w-full [filter:sepia(0.18)_brightness(0.96)]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-stock-950/45 via-transparent to-stock-950/15" />
        </div>

        {/* evidence tags, floated off the surface */}
        {tags.map((t, i) => (
          <motion.div
            key={t.label}
            initial={reduced ? undefined : { opacity: 0, scale: 0.9 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 + i * 0.16, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ left: t.x, top: t.y, transform: "translateZ(46px)" }}
            className="absolute"
          >
            {t.href ? (
              <a
                href={t.href}
                target="_blank"
                rel="noreferrer"
                className={`group flex items-center gap-2 border px-3 py-2 font-mono text-[10px] tracking-[0.1em] uppercase backdrop-blur-md transition-transform hover:-translate-y-0.5 ${
                  t.tone === "seal"
                    ? "-rotate-6 border-seal bg-seal-bg/90 text-seal shadow-[0_10px_30px_-10px_rgba(142,22,22,0.7)]"
                    : "border-brass-deep bg-stock-950/85 text-brass-soft"
                }`}
              >
                <span>
                  <span className="block text-[8.5px] opacity-60">{t.label}</span>
                  {t.value}
                </span>
                <ArrowUpRight className="size-3 opacity-50 transition-opacity group-hover:opacity-100" />
              </a>
            ) : (
              <div className="border border-brass-deep bg-stock-950/85 px-3 py-2 font-mono text-[10px] tracking-[0.1em] text-brass-soft uppercase backdrop-blur-md">
                <span className="block text-[8.5px] opacity-60">{t.label}</span>
                {t.value}
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>

      <p className="mt-4 text-right font-mono text-[9px] tracking-[0.16em] text-ink-faint uppercase">
        bill of exchange · vienna 1854 · public domain
      </p>
    </div>
  );
}
