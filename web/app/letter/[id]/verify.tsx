"use client";

import { useState } from "react";
import { keccak256, hexToString, type Hex } from "viem";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, ShieldCheck, TriangleAlert, X } from "lucide-react";
import type { ChainId } from "@/lib/chain";
import { Badge, Panel } from "@/components/ui";

type Result = {
  documents: Hex | null;
  storedDocHash: Hex;
  expectedValidator: string;
  expectedAgentId: string;
  minScore: number;
  validation: { validator: string; agentId: string; response: number; exists: boolean };
};

type Check = { label: string; ok: boolean; detail: string };

export function VerifyPanel(props: {
  chainId: ChainId;
  letterId: string;
  docHash: Hex;
  docURI: string;
  validator: string;
  agentId: string;
  minScore: number;
}) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/presentation?letterId=${props.letterId}`);
      const data = (await res.json()) as Result & { error?: string };
      if (data.error) throw new Error(data.error);

      const out: Check[] = [];

      // 1. Recompute the hash here, in this browser, from the emitted bytes.
      if (data.documents && data.documents !== "0x") {
        const recomputed = keccak256(data.documents);
        out.push({
          label: "Document body hashes to the committed hash",
          ok: recomputed.toLowerCase() === data.storedDocHash.toLowerCase(),
          detail: recomputed,
        });
        try {
          setBody(JSON.stringify(JSON.parse(hexToString(data.documents)), null, 2));
        } catch {
          setBody(hexToString(data.documents));
        }
      } else {
        out.push({
          label: "Document body present on-chain",
          ok: false,
          detail: "hash-only presentation; body held off-chain",
        });
      }

      // 2. The examination must be by the examiner named at issuance…
      out.push({
        label: "Examined by the examiner named at issuance",
        ok:
          data.validation.exists &&
          data.validation.validator.toLowerCase() === data.expectedValidator.toLowerCase(),
        detail: data.validation.exists
          ? data.validation.validator
          : "no examination opened over this hash",
      });

      // 3. …of this letter's agent…
      out.push({
        label: "Examination is of this letter's agent",
        ok: data.validation.exists && data.validation.agentId === data.expectedAgentId,
        detail: data.validation.exists
          ? `agent #${data.validation.agentId} · letter names #${data.expectedAgentId}`
          : "—",
      });

      // 4. …at or above the threshold written into the letter.
      out.push({
        label: "Score meets the letter's threshold",
        ok: data.validation.exists && data.validation.response >= data.minScore,
        detail: `${data.validation.response}/100 · threshold ${data.minScore}`,
      });

      setChecks(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const allOk = checks?.every((c) => c.ok);

  return (
    <Panel className="p-6 sm:p-7">
      <button
        onClick={run}
        disabled={busy}
        className="group inline-flex items-center gap-2 rounded-lg bg-verd px-5 py-2.5 text-[14px] font-semibold text-stock-950 transition-all duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ShieldCheck className="size-4 transition-transform group-hover:scale-110" />
        )}
        {busy ? "Checking on-chain…" : "Verify this presentation"}
      </button>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 overflow-hidden"
          >
            <div className="flex items-start gap-2 rounded-lg border border-seal-deep bg-seal-bg/70 px-4 py-3 text-[13px] text-seal">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checks && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <div className="space-y-2">
              {checks.map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex flex-wrap items-start justify-between gap-x-5 gap-y-1.5 rounded-lg border px-4 py-3 ${
                    c.ok ? "border-verd-deep/60 bg-stock-750/40" : "border-seal-deep bg-seal-bg/50"
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-[13.5px] text-ink">
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.12 + 0.15, type: "spring", stiffness: 320, damping: 18 }}
                      className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                        c.ok ? "bg-verd text-stock-950" : "bg-seal text-stock-950"
                      }`}
                    >
                      {c.ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                    </motion.span>
                    {c.label}
                  </span>
                  <span className="ml-6 font-mono text-[11.5px] break-all text-ink-faint sm:ml-0 sm:text-right">
                    {c.detail}
                  </span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: checks.length * 0.12 + 0.1 }}
              className="mt-5"
            >
              <Badge tone={allOk ? "ok" : "bad"}>
                {allOk ? <Check className="size-3" /> : <X className="size-3" />}
                {allOk ? "compliant presentation" : "discrepancy"}
              </Badge>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {body && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-7"
          >
            <h3 className="mb-3 font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
              the documents, as emitted on-chain
            </h3>
            <pre className="overflow-x-auto rounded-lg border border-rule bg-stock-950/70 p-4 font-mono text-[12px] leading-relaxed text-ink-soft">
              {body}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
