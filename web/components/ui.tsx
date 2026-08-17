import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "seal" | "ledger";
}) {
  const tones = {
    default: "border-line bg-ink-800/70",
    seal: "border-seal-deep bg-seal-bg/80",
    ledger: "border-ledger-deep bg-ink-800/70",
  } as const;
  return (
    <div
      className={`rounded-xl border ${tones[tone]} backdrop-blur-sm transition-colors duration-300 ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "bad" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "border-line text-parchment-dim",
    ok: "border-ledger-deep text-ledger",
    bad: "border-seal-deep text-seal",
    warn: "border-brass-deep text-brass",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.08em] uppercase ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function KeyValue({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line/70 py-2.5 first:border-t-0">
      <span className="text-[13px] text-parchment-faint">{label}</span>
      <span
        className={`text-right text-[13px] break-all ${mono ? "font-mono text-parchment-dim" : "text-parchment"}`}
      >
        {children}
      </span>
    </div>
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
      className={`group inline-flex items-center gap-1 font-mono break-all text-parchment-dim underline-offset-4 transition-colors hover:text-ledger hover:underline ${className}`}
    >
      {children}
      <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  id,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-28">
      {eyebrow && (
        <div className="mb-2 font-mono text-[11px] tracking-[0.16em] text-parchment-faint uppercase">
          {eyebrow}
        </div>
      )}
      <h2 className="text-xl font-semibold tracking-[-0.01em] text-parchment sm:text-2xl">{title}</h2>
      {children && (
        <p className="mt-2.5 max-w-[70ch] text-[14.5px] leading-relaxed text-parchment-dim">
          {children}
        </p>
      )}
    </div>
  );
}
