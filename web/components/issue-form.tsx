"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Info,
  Loader2,
  PenLine,
  Plus,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { keccak256, parseEther, stringToHex, toFunctionSelector, type Address, type Hex } from "viem";
import { abis, contracts, CHAINS, type ChainId } from "@/lib/chain";
import { Panel } from "@/components/ui";
import { useWallet } from "./wallet";
import { useToast } from "./toast";

/**
 * Issuing is the one write with a struct argument and a mandate to compose, so it
 * gets a purpose-built form rather than the generic action renderer.
 *
 * It is deliberately the most explanatory screen in the app: the mandate is the
 * whole security model, and someone filling it in should be able to see exactly
 * which field stops which class of loss.
 */
export function IssueForm({
  chainId,
  defaults,
}: {
  chainId: ChainId;
  defaults: { vendor: Address; validator: Address; agentId: string };
}) {
  const { address, send } = useWallet();
  const { toast } = useToast();
  const [agentId, setAgentId] = useState(defaults.agentId);
  const [faceValue, setFaceValue] = useState("0.05");
  const [fee, setFee] = useState("0.005");
  const [maxPerCall, setMaxPerCall] = useState("0.02");
  const [hours, setHours] = useState("24");
  const [disputeWindow, setDisputeWindow] = useState("0");
  const [validator, setValidator] = useState<string>(defaults.validator);
  const [minScore, setMinScore] = useState("75");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([defaults.vendor]);
  const [selectors, setSelectors] = useState<string[]>([toFunctionSelector("invoice(bytes32)")]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; hash?: string; message?: string } | null>(null);

  const listField = (
    label: string,
    help: string,
    values: string[],
    setter: (v: string[]) => void,
    placeholder: string,
  ) => (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-ink-dim">{label}</span>
        <button
          onClick={() => setter([...values, ""])}
          className="inline-flex items-center gap-1 text-[11.5px] text-verd hover:underline"
        >
          <Plus className="size-3" />
          add
        </button>
      </div>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={v}
              placeholder={placeholder}
              onChange={(e) => setter(values.map((x, j) => (j === i ? e.target.value : x)))}
              className="w-full rounded-lg border border-rule bg-stock-950/70 px-3 py-2 font-mono text-[12.5px] text-ink outline-none focus:border-brass-deep"
            />
            <button
              onClick={() => setter(values.filter((_, j) => j !== i))}
              className="rounded-lg border border-rule px-2 text-ink-faint hover:border-seal-deep hover:text-seal"
              aria-label="remove"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {values.length === 0 && (
          <p className="rounded-lg border border-dashed border-rule px-3 py-2 text-[12px] text-ink-faint">
            none — nothing can be sent this way
          </p>
        )}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">{help}</p>
    </div>
  );

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const face = parseEther(faceValue);
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Number(hours) * 3600);

      const params = {
        agentId: BigInt(agentId),
        asset: "0x0000000000000000000000000000000000000000" as Address,
        faceValue: face,
        fee: parseEther(fee),
        maxPerCall: parseEther(maxPerCall),
        expiry,
        disputeWindow: BigInt(disputeWindow),
        validator: validator as Address,
        minScore: Number(minScore),
        termsHash: keccak256(stringToHex(`letter-terms-${Date.now()}`)),
        termsURI: "",
        allowedRecipients: recipients.filter(Boolean) as Address[],
        allowedTargets: targets.filter(Boolean) as Address[],
        allowedSelectors: selectors.filter(Boolean) as Hex[],
      };

      const hash = await send({
        address: contracts(chainId).LetterOfCredit,
        abi: abis.LetterOfCredit as readonly unknown[],
        functionName: "issue",
        args: [params],
        value: face,
        chainId,
      });
      setResult({ ok: true, hash });
      toast({
        tone: "sealed",
        title: "Credit issued",
        detail: `${faceValue} locked under your mandate.`,
        href: `${CHAINS[chainId].explorer}/tx/${hash}`,
      });
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string; metaMessages?: string[] };
      const decoded = (err.metaMessages ?? []).find((m) => /^Error: \w+\(/.test(m.trim()));
      const message = decoded?.trim().replace(/^Error:\s*/, "") ?? err.shortMessage ?? err.message;
      setResult({ ok: false, message });
      toast({ tone: "refused", title: "Issue failed", detail: message });
    } finally {
      setBusy(false);
    }
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    help?: string,
    placeholder?: string,
  ) => (
    <label className="block">
      <span className="mb-1 block text-[12px] text-ink-dim">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-rule bg-stock-950/70 px-3 py-2 font-mono text-[12.5px] text-ink outline-none focus:border-brass-deep"
      />
      {help && <span className="mt-1 block text-[11.5px] leading-relaxed text-ink-faint">{help}</span>}
    </label>
  );

  return (
    <Panel className="p-6 sm:p-7">
      <div className="grid gap-5 sm:grid-cols-2">
        {field("Beneficiary agent id", agentId, setAgentId, "The ERC-8004 agent this credit is for.")}
        {field(
          "Examiner",
          validator,
          setValidator,
          "Who is trusted to examine the documents. This is the trust assumption, chosen now.",
        )}
        {field("Face value", faceValue, setFaceValue, "Locked immediately when you sign.", "0.05")}
        {field("Fee", fee, setFee, "Reserved for the agent. Never spendable as working capital.", "0.005")}
        {field("Per-call cap", maxPerCall, setMaxPerCall, "The most that can move in any single call.")}
        {field("Required score", minScore, setMinScore, "1–100. Below this the fee is not payable.")}
        {field("Expires in (hours)", hours, setHours, "After this, unspent value returns to you.")}
        {field(
          "Dispute window (seconds)",
          disputeWindow,
          setDisputeWindow,
          "How long you can object after documents are presented. 0 settles immediately.",
        )}
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-3">
        {listField(
          "Named recipients",
          "Plain payments can only reach these addresses.",
          recipients,
          setRecipients,
          "0x…",
        )}
        {listField(
          "Named contracts",
          "Contract calls can only reach these.",
          targets,
          setTargets,
          "0x…",
        )}
        {listField(
          "Permitted methods",
          "4-byte selectors. Everything else on those contracts stays closed.",
          selectors,
          setSelectors,
          "0x02333318",
        )}
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-brass-deep/60 bg-brass/5 px-4 py-3">
        <Info className="mt-0.5 size-3.5 shrink-0 text-brass" />
        <p className="text-[12px] leading-relaxed text-ink-soft">
          Leave the recipient list empty and a bare transfer has nowhere to go — that is what produces
          the <span className="font-mono text-seal">RecipientNotAllowed</span> refusal. Name a contract
          but not a method, and you get{" "}
          <span className="font-mono text-seal">SelectorNotAllowed</span>. The mandate is the security
          model; everything else is bookkeeping.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !address}
          title={address ? undefined : "Connect a wallet to lock your own funds"}
          className="btn-brass inline-flex items-center gap-2 rounded-sm px-6 py-3 text-[14px] font-semibold transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
          {busy ? "Signing…" : `Issue and lock ${faceValue} ${CHAINS[chainId].symbol}`}
        </button>
        {!address && (
          <span className="text-[12.5px] text-ink-faint">
            Connect a wallet — issuing locks real value, so it is signed by you, never by us.
          </span>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            {result.ok ? (
              <div className="rounded-lg border border-verd-deep bg-stock-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-verd">
                  <ShieldCheck className="size-4" />
                  Letter issued
                </div>
                <a
                  href={`${CHAINS[chainId].explorer}/tx/${result.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11.5px] break-all text-ink-dim hover:text-verd"
                >
                  {result.hash}
                  <ArrowUpRight className="size-3 shrink-0" />
                </a>
                <p className="mt-2 text-[12px] text-ink-dim">
                  It will appear on the letters list once the block is indexed.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-seal-deep bg-seal-bg/60 px-4 py-3 text-[12.5px] text-seal">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span className="font-mono break-all">{result.message}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
