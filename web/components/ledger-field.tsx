"use client";

import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number; r: number };

/**
 * The background field: slow drifting nodes with links drawn between near
 * neighbours, and occasional pulses that travel along a link.
 *
 * Hand-rolled on a canvas rather than pulled from a component gallery, for two
 * reasons: it stays a single file with no runtime dependency, and it can carry a
 * little meaning — the pulses are value moving between parties, so they are
 * sparse and they always terminate. It sits behind everything at low opacity and
 * turns itself off entirely for reduced-motion users and on small screens, where
 * it would cost battery for something nobody is looking at.
 */
export function LedgerField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 720) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let pulses: { from: number; to: number; t: number; speed: number }[] = [];
    let frame = 0;
    let running = true;

    const LINK_DISTANCE = 168;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(64, Math.round((width * height) / 26000));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 0.8 + Math.random() * 1.4,
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

      // Links between near neighbours, faded by distance.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d > LINK_DISTANCE) continue;
          const alpha = (1 - d / LINK_DISTANCE) * 0.14;
          ctx.strokeStyle = `rgba(154,166,182,${alpha.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        ctx.fillStyle = "rgba(180,192,208,0.30)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Occasionally send a settlement along a link.
      if (pulses.length < 3 && Math.random() < 0.014 && nodes.length > 2) {
        const from = Math.floor(Math.random() * nodes.length);
        let to = -1;
        for (let k = 0; k < nodes.length; k++) {
          if (k === from) continue;
          const d = Math.hypot(nodes[from]!.x - nodes[k]!.x, nodes[from]!.y - nodes[k]!.y);
          if (d < LINK_DISTANCE) {
            to = k;
            break;
          }
        }
        if (to >= 0) pulses.push({ from, to, t: 0, speed: 0.012 + Math.random() * 0.01 });
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

        ctx.fillStyle = `rgba(125,211,160,${(0.75 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(125,211,160,${(0.16 * fade).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        return true;
      });

      frame = requestAnimationFrame(step);
    };

    resize();
    frame = requestAnimationFrame(step);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    // Stop burning frames while the tab is in the background.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(step);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -top-1/3 left-1/2 h-[90vh] w-[120vw] -translate-x-1/2 animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(125,211,160,0.10),transparent_70%)] blur-3xl" />
      <div className="absolute top-1/4 -right-1/4 h-[70vh] w-[70vw] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(255,122,104,0.07),transparent_70%)] blur-3xl [animation-delay:-12s]" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-70" />
      <div className="grain absolute inset-0 opacity-[0.35]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,var(--color-ink-900)_92%)]" />
    </div>
  );
}
