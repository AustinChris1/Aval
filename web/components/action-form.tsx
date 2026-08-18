"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Ban, ChevronDown, Loader2, Play, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  finaliseArgs,
  parseArgs,
  valueOf,
  ROLE_LABEL,
  type ActionDef,
} from "@/lib/actions";
import { abis, contracts, type ChainId, CHAINS } from "@/lib/chain";
import { useWallet } from "./wallet";
import { useToast } from "./toast";
import { CHAINS as CHAIN_INFO } from "@/lib/chain";

type Outcome = {
  ok: boolean;
  hash?: string;
  status?: string;
  from?: string;
  message?: string;
  refusalRecorded?: boolean;
};

export function ActionForm({
  action,
  chainId,
  defaults = {},
  demoAvailable,
  open: initiallyOpen = false,
  note,
}: {
  action: ActionDef;
  chainId: ChainId;
  defaults?: Record<string, string>;
  demoAvailable: boolean;
  open?: boolean;
  /**
   * Why this action will not apply to the letter in its current state. Shown, but
   * never used to disable the button: attempting it anyway and reading the
   * contract's own refusal is the more honest lesson.
   */
  note?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [busy, setBusy] = useState<null | "demo" | "wallet">(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { address, send } = useWallet();
  const { toast } = useToast();

  const announce = (o: Outcome) => {
    const href = o.hash ? `${CHAIN_INFO[chainId].explorer}/tx/${o.hash}` : undefined;
    if (!o.ok) {
      toast({ tone: "refused", title: "Call failed", detail: o.message, href });
    } else if (o.refusalRecorded) {
      toast({
        tone: "refused",
        title: "Refused — recorded on-chain",
        detail: `${action.label} was blocked by the mandate, as intended.`,
        href,
      });
    } else if (o.status === "reverted") {
      toast({ tone: "refused", title: "Transaction reverted", detail: action.label, href });
    } else {
      toast({ tone: "sealed", title: `${action.label} — sent`, href });
    }
  };

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  /** Signed server-side with the throwaway demo role key. Testnet only. */
  async function runDemo() {
    setBusy("demo");
    setOutcome(null);
    try {
      const res = await fetch("/api/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: action.id, values, chainId }),
      });
      const data = await res.json();
      const next: Outcome = !res.ok
        ? { ok: false, message: data.error, from: data.from }
        : {
            ok: true,
            hash: data.hash,
            status: data.status,
            from: data.from,
            refusalRecorded: data.refusalRecorded,
          };
      setOutcome(next);
      announce(next);
    } catch (e) {
      const next: Outcome = { ok: false, message: (e as Error).message };
      setOutcome(next);
      announce(next);
    } finally {
      setBusy(null);
    }
  }

  /** Signed by the visitor's own wallet. Works on any network we know about. */
  async function runWallet() {
    setBusy("wallet");
    setOutcome(null);
    try {
      const args = finaliseArgs(action, parseArgs(action, values));
      const hash = await send({
        address: contracts(chainId)[action.contract],
        abi: abis[action.contract] as readonly unknown[],
        functionName: action.fn,
        args,
        value: valueOf(action, values),
        // A refusal has to reach a block to be evidence, so estimation is skipped.
        gas: action.expectRevert ? 500_000n : undefined,
        chainId,
      });
      const next: Outcome = { ok: true, hash, from: address ?? undefined };
      setOutcome(next);
      announce(next);
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string; metaMessages?: string[] };
      const decoded = (err.metaMessages ?? []).find((m) => /^Error: \w+\(/.test(m.trim()));
      const next: Outcome = {
        ok: false,
        message: decoded?.trim().replace(/^Error:\s*/, "") ?? err.shortMessage ?? err.message,
      };
      setOutcome(next);
      announce(next);
    } finally {
      setBusy(null);
    }
  }

  const seal = action.tone === "seal";
  const verd = action.tone === "verd";

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors ${
        seal
          ? "border-seal-deep bg-seal-bg/50"
          : verd
            ? "border-verd-deep/70 bg-stock-800/60"
            : "border-rule bg-stock-800/60"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        {seal ? (
          <Ban className="mt-0.5 size-4 shrink-0 text-seal" />
        ) : verd ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-verd" />
        ) : (
          <Play className="mt-0.5 size-4 shrink-0 text-ink-dim" />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[14.5px] font-semibold ${seal ? "text-seal" : "text-ink"}`}
          >
            {action.label}
          </span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-dim">{action.blurb}</span>
          <span className="mt-1.5 block font-mono text-[11px] text-ink-faint">
            {action.contract}.{action.fn}() · must be sent by {ROLE_LABEL[action.role]}
          </span>
        </span>
        <ChevronDown
          className={`mt-0.5 size-4 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="border-t border-rule/70 px-5 py-4">
              {note && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-brass-deep/60 bg-brass/5 px-3.5 py-2.5 text-[12px] leading-relaxed text-brass">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>{note} You can still send it — the contract will tell you the same thing.</span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {action.fields.map((f) => (
                  <label key={f.name} className={f.type === "json" ? "sm:col-span-2" : ""}>
                    <span className="mb-1 flex items-baseline gap-2 text-[12px] text-ink-dim">
                      {f.label}
                      {f.optional && <span className="text-[10.5px] text-ink-faint">optional</span>}
                    </span>
                    {f.type === "bool" ? (
                      <select
                        value={values[f.name] ?? "true"}
                        onChange={(e) => set(f.name, e.target.value)}
                        className="w-full rounded-lg border border-rule bg-stock-950/70 px-3 py-2 font-mono text-[12.5px] text-ink outline-none focus:border-brass-deep"
                      >
                        <option value="true">yes — for the agent</option>
                        <option value="false">no — for the applicant</option>
                      </select>
                    ) : f.type === "json" ? (
                      <textarea
                        rows={4}
                        value={values[f.name] ?? ""}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full rounded-lg border border-rule bg-stock-950/70 px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-brass-deep"
                      />
                    ) : (
                      <input
                        value={values[f.name] ?? ""}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full rounded-lg border border-rule bg-stock-950/70 px-3 py-2 font-mono text-[12.5px] text-ink outline-none focus:border-brass-deep"
                      />
                    )}
                    {f.help && <span className="mt-1 block text-[11.5px] text-ink-faint">{f.help}</span>}
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {demoAvailable && (
                  <button
                    onClick={runDemo}
                    disabled={busy !== null}
                    className={`inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-[13px] font-semibold transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60 ${
                      seal ? "bg-gradient-to-b from-seal-bright to-seal text-stock-950 shadow-[0_0_24px_-6px_rgba(255,107,90,0.6)]" : "btn-verd"
                    }`}
                  >
                    {busy === "demo" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    Run as {action.role === "anyone" ? "demo" : `the ${action.role}`}
                  </button>
                )}
                <button
                  onClick={runWallet}
                  disabled={busy !== null || !address}
                  title={address ? undefined : "Connect a wallet first"}
                  className="inline-flex items-center gap-2 rounded-lg border border-rule px-4 py-2 text-[13px] text-ink transition-colors hover:border-rule-bright hover:bg-stock-750 disabled:opacity-45"
                >
                  {busy === "wallet" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Send from my wallet
                </button>
              </div>

              {demoAvailable && (
                <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
                  The demo button signs with a throwaway testnet key so you can drive the whole
                  instrument without holding tBOT. It is refused on mainnet.
                </p>
              )}

              <AnimatePresence>
                {outcome && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4"
                  >
                    {outcome.ok ? (
                      <div
                        className={`rounded-lg border px-4 py-3 ${
                          outcome.refusalRecorded || outcome.status === "reverted"
                            ? "border-seal-deep bg-seal-bg/70"
                            : "border-verd-deep bg-stock-950/60"
                        }`}
                      >
                        <div
                          className={`text-[13px] font-semibold ${
                            outcome.refusalRecorded || outcome.status === "reverted"
                              ? "text-seal"
                              : "text-verd"
                          }`}
                        >
                          {outcome.refusalRecorded
                            ? "Refused, and recorded on-chain"
                            : outcome.status === "reverted"
                              ? "Transaction reverted"
                              : "Sent"}
                        </div>
                        <a
                          href={`${CHAINS[chainId].explorer}/tx/${outcome.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11.5px] break-all text-ink-dim hover:text-verd"
                        >
                          {outcome.hash}
                          <ArrowUpRight className="size-3 shrink-0" />
                        </a>
                        {outcome.refusalRecorded && (
                          <p className="mt-2 text-[12px] leading-relaxed text-ink-dim">
                            Open it: the attempt is in a block, and it moved nothing.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 rounded-lg border border-seal-deep bg-seal-bg/60 px-4 py-3 text-[12.5px] text-seal">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                        <span className="font-mono break-all">{outcome.message}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
