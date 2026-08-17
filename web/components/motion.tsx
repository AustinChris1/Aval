"use client";

import { motion, useInView, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/** Rises into place once, when scrolled to. Never animates back out. */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.62, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Staggers its children in document order. */
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
}: {
  children: ReactNode[];
  className?: string;
  stagger?: number;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal key={i} delay={i * stagger}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

/**
 * Counts up to a number when it scrolls into view.
 *
 * The true value is what renders on the server and what sits in the markup. The
 * animation is layered on top only once the element is actually in view, and only
 * for people who have not asked for reduced motion. That ordering matters here:
 * these numbers include how many payments the chain refused, and a page that
 * renders "0 refusals" whenever JavaScript is slow, blocked, or screenshotted
 * early would be misstating the one fact the page exists to show.
 */
export function CountUp({
  to,
  decimals = 0,
  suffix = "",
  className,
}: {
  to: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const raw = useMotionValue(0);
  const spring = useSpring(raw, { stiffness: 70, damping: 22, mass: 0.6 });

  useEffect(() => {
    if (reduced || !inView) return;

    // Subscribing only now means the rendered value is never overwritten with 0
    // unless an animation is genuinely about to run to completion.
    const unsubscribe = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = v.toFixed(decimals) + suffix;
    });
    raw.set(to);

    return () => {
      unsubscribe();
      // Whatever happens, leave the truth on screen.
      if (ref.current) ref.current.textContent = to.toFixed(decimals) + suffix;
    };
  }, [inView, reduced, raw, spring, to, decimals, suffix]);

  return (
    <span ref={ref} className={className}>
      {to.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Word-by-word entrance for a single headline. Used once per page, at most. */
export function SplitHeadline({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {text.split(" ").map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: "0.4em" }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 + i * 0.045, ease: [0.16, 1, 0.3, 1] }}
        >
          {word}
          {i < text.split(" ").length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}

/** A hairline that draws itself in as it enters view. */
export function DrawRule({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`rule origin-left ${className ?? ""}`}
      initial={reduced ? undefined : { scaleX: 0, opacity: 0 }}
      whileInView={reduced ? undefined : { scaleX: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}
