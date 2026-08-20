// The AV Lozenge: an A over an inverted A forming the lozenge of a bill of exchange, crimson seal at the crossing; stroke-drawn to inherit the theme, legible at 16px (also the favicon).
export function Mark({
  className = "",
  tone = "ink",
}: {
  className?: string;
  tone?: "brass" | "verd" | "seal" | "ink";
}) {
  const aStroke = {
    ink: "currentColor",
    brass: "var(--color-brass)",
    verd: "var(--color-verd)",
    seal: "var(--color-seal)",
  }[tone];

  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden>
      {/* the V, the counterparty's stroke, set back in muted sand */}
      <path
        d="M 55 35 L 100 165 L 145 35"
        stroke="var(--color-brass-deep)"
        strokeWidth="17"
        strokeLinecap="square"
      />
      {/* the A, the principal's stroke, in ink */}
      <path d="M 55 165 L 100 35 L 145 165" stroke={aStroke} strokeWidth="17" strokeLinecap="square" />
      <path d="M 76 118 L 124 118" stroke={aStroke} strokeWidth="17" strokeLinecap="square" />
      {/* the seal at the crossing */}
      <path d="M 100 83 L 117 100 L 100 117 L 83 100 Z" className="aval-mark-seal" />
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
