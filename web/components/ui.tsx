import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The furniture of an engraved instrument.
 *
 * These are deliberately not generic dashboard cards. A documentary credit is a
 * printed object with a letterhead, a reference number, ruled entries and a
 * margin for annotations, so the components below are those parts — which is why
 * almost nothing here is a rounded box with an icon in the corner.
 */

/** A ruled entry line, the way a printed instrument lists its terms. */
export function Entry({
  label,
  children,
  mono = true,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
      <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink-faint uppercase">
        {label}
      </span>
      {/* leader dots, as on a printed schedule */}
      <span className="hidden h-px min-w-6 flex-1 self-center border-b border-dotted border-rule sm:block" />
      <span
        className={`min-w-0 break-all ${
          emphasis ? "text-[15px] text-ink" : "text-[13px] text-ink-soft"
        } ${mono ? "font-mono" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}

/** A sheet of the instrument: hairline border, no rounding, faint hatching. */
export function Sheet({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "seal" | "verd" | "brass";
}) {
  const tones = {
    default: "border-rule",
    seal: "border-seal-deep",
    verd: "border-verd-deep",
    brass: "border-brass-deep",
  } as const;
  return (
    <div
      className={`relative border ${tones[tone]} bg-stock-850/70 backdrop-blur-[2px] ${className}`}
    >
      {children}
    </div>
  );
}

/** A short uppercase label, set in mono, used instead of pill badges. */
export function Stamp({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "bad" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "border-rule text-ink-dim",
    ok: "border-verd-deep text-verd",
    bad: "border-seal-deep text-seal",
    warn: "border-brass-deep text-brass",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[10px] tracking-[0.16em] uppercase ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Addr({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`group inline-flex items-center gap-1 font-mono break-all text-ink-soft underline-offset-4 transition-colors hover:text-verd hover:underline ${className}`}
    >
      {children}
      <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

/**
 * A section opening: a numbered clause marker in the margin, the heading, and an
 * optional standfirst. The number is what makes the page read as an instrument
 * rather than a landing page.
 */
export function Clause({
  n,
  eyebrow,
  title,
  children,
  id,
}: {
  n?: string;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-28 lg:grid lg:grid-cols-[80px_minmax(0,1fr)] lg:gap-8">
      <div className="mb-3 lg:mb-0 lg:pt-2 lg:text-right">
        {n && (
          <span className="font-mono text-[11px] tracking-[0.1em] text-brass/60 tabular-nums">
            {n}
          </span>
        )}
      </div>
      <div>
        {eyebrow && (
          <div className="mb-2 font-mono text-[10.5px] tracking-[0.2em] text-ink-faint uppercase">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-[28px] leading-[1.12] tracking-[-0.01em] text-ink sm:text-[36px]">
          {title}
        </h2>
        {children && (
          <p className="mt-3.5 max-w-[66ch] text-[15px] leading-[1.7] text-ink-soft">{children}</p>
        )}
      </div>
    </div>
  );
}

/** Body content aligned to the clause column, so the page holds one spine. */
export function ClauseBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`lg:grid lg:grid-cols-[80px_minmax(0,1fr)] lg:gap-8 ${className}`}>
      <div aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** An annotation set in the margin, the way a clerk would note a document. */
export function MarginNote({ children }: { children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[80px_minmax(0,1fr)] lg:gap-8">
      <div aria-hidden />
      <p className="border-l-2 border-brass-deep pl-4 text-[13px] leading-[1.7] text-ink-dim italic">
        {children}
      </p>
    </div>
  );
}

/** The wax seal ornament. Used only where something was granted or refused. */
export function SealDot({ className = "", tone = "seal" }: { className?: string; tone?: "seal" | "verd" }) {
  const c = tone === "seal" ? "border-seal-deep bg-seal-bg" : "border-verd-deep bg-stock-800";
  const dot = tone === "seal" ? "bg-seal" : "bg-verd";
  return (
    <span className={`relative inline-flex size-10 items-center justify-center rounded-full border ${c} ${className}`}>
      <span className={`absolute inset-0 animate-seal rounded-full ${tone === "seal" ? "bg-seal/10" : "bg-verd/10"}`} />
      <span className={`size-1.5 rounded-full ${dot}`} />
    </span>
  );
}

/**
 * Compatibility aliases.
 *
 * The instrument vocabulary above replaced an earlier dashboard vocabulary. The
 * prop shapes are identical, so pages not yet re-set in the new style keep
 * working while they are converted one at a time.
 */
export const Panel = Sheet;
export const Badge = Stamp;
export const KeyValue = Entry;
export const SectionHeading = Clause;
export const Seal = SealDot;
