"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Toasts, in the house style: not floating pills but stamped receipt slips.
 * Three tones map to the instrument's states, sealed (gold, a thing granted),
 * refused (crimson, a thing refused, which for this product is often the
 * success case), and note (neutral ink).
 */
export type ToastTone = "sealed" | "refused" | "note";

type ToastInput = {
  tone: ToastTone;
  title: string;
  detail?: string;
  /** Explorer link, shown as a mono chip with an arrow. */
  href?: string;
  linkLabel?: string;
};

type Toast = ToastInput & { id: number };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const LIFETIME_MS = 7000;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { ...input, id }]);
      window.setTimeout(() => dismiss(id), LIFETIME_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2.5">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={`sheet-depth pointer-events-auto relative border px-4 py-3 ${
                t.tone === "refused"
                  ? "border-seal-deep glow-seal"
                  : t.tone === "sealed"
                    ? "border-verd-deep glow-verd"
                    : "border-rule"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                    t.tone === "refused"
                      ? "bg-seal text-stock-950"
                      : t.tone === "sealed"
                        ? "bg-verd text-stock-950"
                        : "border border-rule text-ink-dim"
                  }`}
                >
                  {t.tone === "refused" ? (
                    <X className="size-3" strokeWidth={3} />
                  ) : t.tone === "sealed" ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : (
                    <Info className="size-3" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div
                    className={`font-mono text-[11px] font-bold tracking-[0.12em] uppercase ${
                      t.tone === "refused" ? "text-seal" : t.tone === "sealed" ? "text-verd" : "text-ink"
                    }`}
                  >
                    {t.title}
                  </div>
                  {t.detail && (
                    <div className="mt-1 font-mono text-[11px] leading-relaxed break-words text-ink-dim">
                      {t.detail}
                    </div>
                  )}
                  {t.href && (
                    <a
                      href={t.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.12em] text-ink-soft uppercase underline-offset-4 hover:text-verd hover:underline"
                    >
                      {t.linkLabel ?? "view on explorer"}
                      <ArrowUpRight className="size-3" />
                    </a>
                  )}
                </div>

                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="shrink-0 text-ink-faint transition-colors hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
