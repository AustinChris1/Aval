import { formatEther, toFunctionSelector, encodeFunctionData, keccak256, stringToHex } from "viem";
import Link from "next/link";
import { ArrowLeft, Ban, Coins, Lock } from "lucide-react";
import { STATUS, addressUrl, chainInfo, contracts, short, abis } from "@/lib/chain";
import { activeChainId } from "@/lib/active-chain";
import { getLetter, getTimeline } from "@/lib/indexer";
import { actionById } from "@/lib/actions";
import { DEMO_CHAIN_ID, demoAvailable } from "@/lib/demo";
import { Addr, Badge, KeyValue, Panel, SectionHeading } from "@/components/ui";
import { CountUp, DrawRule, Reveal } from "@/components/motion";
import { Timeline } from "@/components/timeline";
import { ActionForm } from "@/components/action-form";
import { VerifyPanel } from "./verify";

const ZERO_HASH = `0x${"0".repeat(64)}`;

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chainId = await activeChainId();
  const letterId = BigInt(id);
  const info = chainInfo(chainId);
  const c = contracts(chainId);
  const demo = demoAvailable() && chainId === DEMO_CHAIN_ID;

  const [state, timeline] = await Promise.all([
    getLetter(chainId, letterId),
    getTimeline(chainId, letterId),
  ]);

  const { letter, mandate, available, holder, docURI } = state;
  const status = STATUS[letter.status] ?? "?";
  const expired = BigInt(Math.floor(Date.now() / 1000)) > letter.expiry;
  const refusals = timeline.rows.filter((r) => r.refused).length;

  const rows = timeline.rows.map((r) => ({
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    hash: r.hash,
    blockNumber: String(r.blockNumber),
    refused: r.refused,
    error: r.error,
  }));

  // Starting values derived from this credit, so nobody hand-copies an address into a form.
  const firstTarget = mandate.targets[0] ?? c.ServiceVendor;
  const invoiceCalldata = encodeFunctionData({
    abi: abis.ServiceVendor,
    functionName: "invoice",
    args: [keccak256(stringToHex(`invoice-${id}`))],
  });
  const perCall = formatEther(mandate.perCallCap);
  const documents = JSON.stringify(
    {
      job: "Settle approved supplier invoice",
      letterId: id,
      paidTo: firstTarget,
      amount: mandate.perCallCap.toString(),
    },
    null,
    2,
  );

  const AGENT_ACTIONS = ["payToBlocked", "payTo", "execute", "presentDocuments"] as const;
  const SETTLE_ACTIONS = ["validationRequest", "validationResponse", "draw"] as const;
  const CLOSE_ACTIONS = ["dispute", "resolveDispute", "refundExpired", "cancel"] as const;

  const defaultsFor = (actionId: string): Record<string, string> => {
    switch (actionId) {
      case "payToBlocked":
        return { letterId: id, recipient: "", amount: perCall };
      case "payTo":
        return { letterId: id, recipient: mandate.recipients[0] ?? "", amount: perCall };
      case "execute":
        return { letterId: id, target: firstTarget, value: perCall, data: invoiceCalldata };
      case "presentDocuments":
        return { letterId: id, documentURI: "", documents };
      case "validationRequest":
        return {
          validatorAddress: letter.validator,
          agentId: String(letter.agentId),
          requestURI: "",
          requestHash: letter.docHash,
        };
      case "validationResponse":
        return {
          requestHash: letter.docHash,
          response: String(Math.max(letter.minScore, 100)),
          responseURI: "",
          responseHash: "",
          tag: "letter",
        };
      case "resolveDispute":
        return { letterId: id, favourBeneficiary: "true", resolutionURI: "" };
      default:
        return { letterId: id, reasonURI: "" };
    }
  };

  // Why an action cannot apply right now; forms stay enabled so a status refusal is not mistaken for a mandate refusal.
  const noteFor = (actionId: string): string | undefined => {
    const st = letter.status;
    const needsOpen = ["payToBlocked", "payTo", "execute", "presentDocuments"];
    if (needsOpen.includes(actionId) && st === 1 && expired) {
      return `This credit expired on ${new Date(Number(letter.expiry) * 1000).toUTCString()}, so every agent action will be refused with LetterExpired. Pick a newer Open credit from the register; the applicant can reclaim the unspent balance below.`;
    }
    if (needsOpen.includes(actionId) && st !== 1) {
      return `This credit is ${status}, and the agent may only act while a credit is Open, so this will be refused with BadStatus rather than by the mandate.`;
    }
    if (actionId === "draw" && st !== 2) {
      return `Drawing requires documents to have been presented; this credit is ${status}.`;
    }
    if (actionId === "dispute" && st !== 2) {
      return `A dispute can only be raised against a presentation; this credit is ${status}.`;
    }
    if (actionId === "resolveDispute" && st !== 3) {
      return `There is no open dispute on this credit; it is ${status}.`;
    }
    if (actionId === "cancel" && (st !== 1 || letter.spent > 0n)) {
      return letter.spent > 0n
        ? "Capital has already been spent, so this credit can no longer be cancelled."
        : `Only an Open credit can be cancelled; this one is ${status}.`;
    }
    if (actionId === "refundExpired" && !expired) {
      return "This credit has not expired yet, so nothing can be reclaimed.";
    }
    if (actionId === "validationRequest" && letter.docHash === ZERO_HASH) {
      return "No documents have been presented yet, so there is no hash to examine.";
    }
    if (actionId === "validationResponse" && letter.docHash === ZERO_HASH) {
      return "No documents have been presented yet, so there is nothing to score.";
    }
    return undefined;
  };

  const renderActions = (ids: readonly string[]) =>
    ids.map((actionId, i) => {
      const action = actionById(actionId);
      if (!action) return null;
      return (
        <Reveal key={actionId} delay={i * 0.05}>
          <ActionForm
            action={action}
            chainId={chainId}
            demoAvailable={demo}
            defaults={defaultsFor(actionId)}
            note={noteFor(actionId)}
          />
        </Reveal>
      );
    });

  return (
    <>
      <section className="pt-14 pb-10">
        <Reveal y={8}>
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-[13px] text-ink-faint transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            the register
          </Link>
        </Reveal>

        <Reveal delay={0.05} className="mt-5 flex flex-wrap items-center gap-4">
          <h1 className="font-display text-[40px] leading-none tracking-[-0.015em] text-ink sm:text-[54px]">
            Credit №{String(id).padStart(4, "0")}
          </h1>
          <Badge tone={status === "Settled" ? "ok" : "warn"}>
            {letter.status === 1 && expired ? "Expired" : status}
          </Badge>
        </Reveal>

        <Reveal delay={0.12} className="mt-6 max-w-[68ch]">
          <p className="text-[15.5px] leading-relaxed text-ink-soft">
            Every row was read from the chain. The refusals are mined transactions, not logs the
            agent wrote about itself.
          </p>
        </Reveal>

        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Lock,
              value: Number(formatEther(letter.faceValue)),
              decimals: 3,
              label: "face value locked",
              tone: "text-ink",
              panel: "default" as const,
            },
            {
              icon: Coins,
              value: Number(formatEther(letter.fee)),
              decimals: 3,
              label: "fee reserved, not spendable",
              tone: "text-verd",
              panel: "verd" as const,
            },
            {
              icon: Ban,
              value: refusals,
              decimals: 0,
              label: "refusals recorded on-chain",
              tone: "text-seal",
              panel: (refusals > 0 ? "seal" : "default") as "seal" | "default",
            },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.18 + i * 0.07}>
              <Panel tone={s.panel} className="p-6">
                <s.icon className={`size-4 ${s.tone}`} />
                <div className={`mt-3 font-display text-[38px] leading-none ${s.tone}`}>
                  <CountUp to={s.value} decimals={s.decimals} />
                </div>
                <div className="mt-2 text-[13px] text-ink-faint">{s.label}</div>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>

      <DrawRule />

      <section className="py-14">
        <SectionHeading n="§ 01" eyebrow="issuance to settlement" title="Timeline" id="timeline" />

        {!timeline.explorerAvailable && (
          <Reveal className="mt-5">
            <Panel tone="brass" className="p-4">
              <p className="text-[13px] leading-relaxed text-brass">
                The explorer&apos;s transaction index is unreachable, so refused attempts cannot be
                listed right now. The successful steps come from <code>eth_getLogs</code> and are
                unaffected, a reverted call emits no logs, so there is no RPC-only way to enumerate
                them.
              </p>
            </Panel>
          </Reveal>
        )}

        {rows.length > 0 ? (
          <Timeline rows={rows} txBase={info.explorer} />
        ) : (
          <Panel className="mt-6 p-6 text-[13.5px] text-ink-faint">No activity found.</Panel>
        )}
      </section>

      <DrawRule />

      {/* --- the interactive half ------------------------------------------ */}

      <section className="py-14">
        <SectionHeading n="§ 02" eyebrow="drive it yourself" title="Act as the agent">
          Only the ERC-8004-bound wallet gets through. Try it from your own:{" "}
          <span className="font-mono text-seal">NotAgentWallet</span> is itself the demonstration.
        </SectionHeading>
        <div className="mt-7 space-y-3">{renderActions(AGENT_ACTIONS)}</div>
      </section>

      <section className="pb-14">
        <SectionHeading n="§ 03" eyebrow="examination and payment" title="Examine, then settle">
          Score below the threshold and the fee is not payable:{" "}
          <span className="font-mono text-seal">ScoreBelowThreshold</span>.
        </SectionHeading>
        <div className="mt-7 space-y-3">{renderActions(SETTLE_ACTIONS)}</div>
      </section>

      <section className="pb-14">
        <SectionHeading n="§ 04" eyebrow="if it goes wrong" title="Dispute, refund, cancel" />
        <div className="mt-7 space-y-3">{renderActions(CLOSE_ACTIONS)}</div>
      </section>

      <DrawRule />

      <section className="py-14">
        <SectionHeading n="§ 05" eyebrow="the rulebook" title="The mandate">
          Written at issuance and immutable afterwards. This is what the agent could and could not do
         , and the reason the refusals above exist.
        </SectionHeading>
        <Reveal className="mt-7">
          <Panel className="p-6">
            <KeyValue label="Per-call cap" mono>
              {formatEther(mandate.perCallCap)}
            </KeyValue>
            <KeyValue label="Working capital left" mono>
              {formatEther(available)}
            </KeyValue>
            <KeyValue label="Named recipients" mono>
              {mandate.recipients.length ? mandate.recipients.join(", ") : "none"}
            </KeyValue>
            <KeyValue label="Named contracts" mono>
              {mandate.targets.length
                ? mandate.targets.map((t) => (
                    <Addr key={t} href={addressUrl(chainId, t)} className="block">
                      {t}
                    </Addr>
                  ))
                : "none"}
            </KeyValue>
            <KeyValue label="Permitted methods" mono>
              {mandate.selectors.length ? mandate.selectors.join(", ") : "none"}
            </KeyValue>
            <KeyValue label="Expiry" mono>
              {new Date(Number(letter.expiry) * 1000).toISOString()}
            </KeyValue>
          </Panel>
        </Reveal>
      </section>

      <section className="pb-14">
        <SectionHeading n="§ 06" eyebrow="who is who" title="Parties" />
        <Reveal className="mt-7">
          <Panel className="p-6">
            <KeyValue label="Applicant, locked the funds" mono>
              <Addr href={addressUrl(chainId, letter.applicant)}>
                <span className="hidden sm:inline">{letter.applicant}</span>
                <span className="sm:hidden">{short(letter.applicant, 8, 6)}</span>
              </Addr>
            </KeyValue>
            <KeyValue label="Beneficiary agent">
              <Link
                href={`/agent/${letter.agentId}`}
                className="font-mono text-ink-soft underline-offset-4 hover:text-verd hover:underline"
              >
                #{String(letter.agentId)}
              </Link>
            </KeyValue>
            <KeyValue label="Credit holder, receives the fee" mono>
              {holder ?? "—"}
            </KeyValue>
            <KeyValue label="Examiner" mono>
              <Addr href={addressUrl(chainId, letter.validator)}>
                <span className="hidden sm:inline">{letter.validator}</span>
                <span className="sm:hidden">{short(letter.validator, 8, 6)}</span>
              </Addr>
            </KeyValue>
            <KeyValue label="Required score" mono>
              {letter.minScore}/100
            </KeyValue>
          </Panel>
        </Reveal>
      </section>

      <DrawRule />

      <section className="py-14">
        <SectionHeading n="§ 07" eyebrow="do not trust this page" title="Verify the presentation yourself">
          The bytes are re-hashed in your browser. Nothing is taken on trust from this page.
        </SectionHeading>
        <Reveal className="mt-7">
          <VerifyPanel
            chainId={chainId}
            letterId={id}
            docHash={letter.docHash}
            docURI={docURI}
            validator={letter.validator}
            agentId={String(letter.agentId)}
            minScore={letter.minScore}
          />
        </Reveal>
      </section>
    </>
  );
}
