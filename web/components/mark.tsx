/**
 * The AVAL seal.
 *
 * "Per aval" is a guarantee written directly onto a bill of exchange — a third
 * party endorsing that the instrument will be honoured. The mark is that idea:
 * an engraved seal with a chord struck across it, because an aval is a signature
 * laid *over* someone else's paper.
 *
 * Drawn rather than lettered so the identity does not depend on a webfont, and so
 * the same geometry can be inked in brass, verdigris or oxblood as the state
 * requires.
 */
export function Mark({
  className = "",
  tone = "brass",
}: {
  className?: string;
  tone?: "brass" | "verd" | "seal" | "ink";
}) {
  const stroke = {
    brass: "var(--color-brass)",
    verd: "var(--color-verd)",
    seal: "var(--color-seal)",
    ink: "var(--color-ink)",
  }[tone];

  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      {/* the seal: two concentric rings, the outer one milled like a coin */}
      <circle cx="24" cy="24" r="21" stroke={stroke} strokeWidth="1.1" opacity="0.5" />
      <circle cx="24" cy="24" r="16.5" stroke={stroke} strokeWidth="1.6" />
      <g stroke={stroke} strokeWidth="1.1" opacity="0.55">
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const r1 = 18.6;
          const r2 = 21;
          return (
            <line
              key={i}
              x1={24 + Math.cos(a) * r1}
              y1={24 + Math.sin(a) * r1}
              x2={24 + Math.cos(a) * r2}
              y2={24 + Math.sin(a) * r2}
            />
          );
        })}
      </g>
      {/* the A of aval, cut as a chord across the seal */}
      <path d="M17 31.5 L24 15.5 L31 31.5" stroke={stroke} strokeWidth="2.1" strokeLinecap="square" />
      <path d="M19.9 25.6 H28.1" stroke={stroke} strokeWidth="2.1" strokeLinecap="square" />
    </svg>
  );
}

/** The full lockup: mark plus wordmark, letterspaced like an engraved plate. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className="size-[26px] shrink-0" />
      <span className="font-display text-[23px] leading-none tracking-[0.24em] text-ink">AVAL</span>
    </span>
  );
}
