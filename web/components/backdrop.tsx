"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

/**
 * Builds a hypotrochoid — the interlaced curve that engraved security printing
 * uses on share certificates, banknotes and, historically, letters of credit.
 * It is here because it is the correct ornament for the object, not decoration
 * for its own sake.
 */
function guilloche(R: number, r: number, d: number, turns = 60, step = 0.06) {
  const points: string[] = [];
  const k = (R - r) / r;
  for (let t = 0; t <= Math.PI * 2 * turns; t += step) {
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${points.join("L")}`;
}

function Guilloche() {
  // Computed once; these are pure functions of their parameters.
  const outer = useMemo(() => guilloche(220, 63, 92, 63), []);
  const inner = useMemo(() => guilloche(150, 41, 66, 41), []);

  return (
    <svg
      className="absolute top-1/2 left-1/2 h-[150vmin] w-[150vmin] -translate-x-1/2 -translate-y-1/2"
      viewBox="-260 -260 520 520"
      fill="none"
      aria-hidden
    >
      <g className="origin-center animate-[spin_240s_linear_infinite]">
        <path d={outer} stroke="var(--color-brass)" strokeWidth="0.3" opacity="0.42" />
      </g>
      <g className="origin-center animate-[spin_180s_linear_infinite_reverse]">
        <path d={inner} stroke="var(--color-verd)" strokeWidth="0.28" opacity="0.3" />
      </g>
    </svg>
  );
}

type Node = { x: number; y: number; vx: number; vy: number; r: number };

/**
 * A slow field of drifting nodes with links between near neighbours, and
 * occasional pulses that travel along a link and terminate — value settling
 * between two parties.
 *
 * Hand-rolled on a canvas so it stays one file with no runtime dependency. It
 * disables itself entirely for reduced-motion users, on narrow screens, and
 * whenever the tab is hidden.
 */
function LedgerField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 768) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let pulses: { from: number; to: number; t: number; speed: number }[] = [];
    let frame = 0;
    let running = true;
    const LINK = 176;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(58, Math.round((width * height) / 30000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        r: 0.7 + Math.random() * 1.3,
      }));
      pulses = [];
    };

    const step = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK) continue;
          ctx.strokeStyle = `rgba(148,141,132,${((1 - d / LINK) * 0.3).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        ctx.fillStyle = "rgba(201,195,186,0.5)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (pulses.length < 3 && Math.random() < 0.012 && nodes.length > 2) {
        const from = Math.floor(Math.random() * nodes.length);
        for (let k = 0; k < nodes.length; k++) {
          if (k === from) continue;
          if (Math.hypot(nodes[from]!.x - nodes[k]!.x, nodes[from]!.y - nodes[k]!.y) < LINK) {
            pulses.push({ from, to: k, t: 0, speed: 0.011 + Math.random() * 0.009 });
            break;
          }
        }
      }

      pulses = pulses.filter((p) => {
        p.t += p.speed;
        if (p.t >= 1) return false;
        const a = nodes[p.from];
        const b = nodes[p.to];
        if (!a || !b) return false;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const fade = Math.sin(p.t * Math.PI);

        ctx.strokeStyle = `rgba(94,207,168,${(0.35 * fade).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = `rgba(127,232,196,${(1.0 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.9, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      frame = requestAnimationFrame(step);
    };

    resize();
    frame = requestAnimationFrame(step);

    const onResize = () => resize();
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(step);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export function Backdrop() {
  /**
   * Full intensity in the hero, then dimmed as the reader scrolls into the
   * clauses. The engraving is a cover ornament: it should never compete with a
   * paragraph someone is actually reading.
   */
  const { scrollY } = useScroll();
  const reduced = useReducedMotion();
  const raw = useTransform(scrollY, [0, 700], [1, 0.3]);
  const dimmed = useSpring(raw, { stiffness: 90, damping: 26 });

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* the page's own ambient gradients — body is transparent by design */}
      <div className="absolute inset-0 bg-[radial-gradient(1400px_700px_at_50%_-12%,rgba(216,166,87,0.10),transparent_60%),radial-gradient(1000px_600px_at_8%_18%,rgba(94,207,168,0.07),transparent_60%)]" />
      <motion.div style={reduced ? { opacity: 0.45 } : { opacity: dimmed }} className="absolute inset-0">
      <div className="absolute -top-1/3 left-1/2 h-[95vh] w-[130vw] -translate-x-1/2 animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(94,207,168,0.22),transparent_70%)] blur-3xl" />
      <div className="absolute top-1/3 -right-1/4 h-[75vh] w-[75vw] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(216,166,87,0.20),transparent_70%)] blur-3xl [animation-delay:-16s]" />
      <div className="absolute bottom-0 -left-1/4 h-[60vh] w-[70vw] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(255,107,90,0.12),transparent_70%)] blur-3xl [animation-delay:-28s]" />
      <div className="absolute inset-0 opacity-90">
        <Guilloche />
      </div>
      <LedgerField />
      <div className="hatch absolute inset-0 opacity-40" />
      <div className="grain absolute inset-0 opacity-30" />
      </motion.div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(10,13,24,0.72)_100%)]" />
    </div>
  );
}
