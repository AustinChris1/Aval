import { formatEther } from "viem";
import Link from "next/link";
import { ArrowLeft, Ban, Coins, Lock } from "lucide-react";
import { DEFAULT_CHAIN_ID, STATUS, addressUrl, chainInfo, short } from "@/lib/chain";
import { getLetter, getTimeline } from "@/lib/indexer";
import { Addr, Badge, KeyValue, Panel, SectionHeading } from "@/components/ui";
import { CountUp, DrawRule, Reveal } from "@/components/motion";
import { Timeline } from "@/components/timeline";
import { VerifyPanel } from "./verify";

export const revalidate = 10;

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chainId = DEFAULT_CHAIN_ID;
  const letterId = BigInt(id);
  const info = chainInfo(chainId);

  const [state, timeline] = await Promise.all([
    getLetter(chainId, letterId),
    getTimeline(chainId, letterId),
  ]);

  const { letter, mandate, available, holder, docURI } = state;
  const status = STATUS[letter.status] ?? "?";
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

  return (
    <>
      <section className="pt-14 pb-10">
        <Reveal y={8}>
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-[13px] text-parchment-faint transition-colors hover:text-parchment"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            all letters
          </Link>
        </Reveal>

        <Reveal delay={0.05} className="mt-5 flex flex-wrap items-center gap-4">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-parchment sm:text-4xl">
            Letter #{id}
          </h1>
          <Badge tone={status === "Settled" ? "ok" : "warn"}>{status}</Badge>
        </Reveal>

        <Reveal delay={0.12} className="mt-5 max-w-[68ch]">
          <p className="text-[15.5px] leading-relaxed text-parchment-dim">
            Every row below was read from the chain. The refusals are mined transactions — the agent
            asked, and the letter said no. Nothing here is a log the agent wrote about itself.
          </p>
        </Reveal>

        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Lock,
              value: Number(formatEther(letter.faceValue)),
              decimals: 2,
              label: "face value locked",
              tone: "text-parchment",
            },
            {
              icon: Coins,
              value: Number(formatEther(letter.fee)),
              decimals: 2,
              label: "fee reserved — not spendable",
              tone: "text-ledger",
            },
            {
              icon: Ban,
              value: refusals,
              decimals: 0,
              label: "refusals recorded on-chain",
              tone: "text-seal",
            },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.18 + i * 0.07}>
              <Panel tone={s.tone === "text-seal" && refusals > 0 ? "seal" : "default"} className="p-6">
                <s.icon className={`size-4 ${s.tone}`} />
                <div className={`mt-3 text-3xl font-semibold tracking-[-0.02em] ${s.tone}`}>
                  <CountUp to={s.value} decimals={s.decimals} />
                </div>
                <div className="mt-1.5 text-[13px] text-parchment-faint">{s.label}</div>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>

      <DrawRule />

      <section className="py-14">
        <SectionHeading eyebrow="issuance to settlement" title="Timeline" id="timeline" />

        {!timeline.explorerAvailable && (
          <Reveal className="mt-5">
            <Panel tone="default" className="border-brass-deep p-4">
              <p className="text-[13px] leading-relaxed text-brass">
                The explorer&apos;s transaction index is unreachable, so refused attempts cannot be
                listed right now. The successful steps come from <code>eth_getLogs</code> and are
                unaffected — a reverted call emits no logs, so there is no RPC-only way to enumerate
                them.
              </p>
            </Panel>
          </Reveal>
        )}

        {rows.length > 0 ? (
          <Timeline rows={rows} txBase={info.explorer} />
        ) : (
          <Panel className="mt-6 p-6 text-[13.5px] text-parchment-faint">No activity found.</Panel>
        )}
      </section>

      <DrawRule />

      <section className="py-14">
        <SectionHeading
          eyebrow="the rulebook"
          title="The mandate"
        >
          Written at issuance and immutable afterwards. This is what the agent could and could not
          do — and the reason the refusals above exist.
        </SectionHeading>
        <Reveal className="mt-6">
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
        <SectionHeading eyebrow="who is who" title="Parties" />
        <Reveal className="mt-6">
          <Panel className="p-6">
            <KeyValue label="Applicant — locked the funds" mono>
              <Addr href={addressUrl(chainId, letter.applicant)}>
                <span className="hidden sm:inline">{letter.applicant}</span>
                <span className="sm:hidden">{short(letter.applicant, 8, 6)}</span>
              </Addr>
            </KeyValue>
            <KeyValue label="Beneficiary agent">
              <Link
                href={`/agent/${letter.agentId}`}
                className="font-mono text-parchment-dim underline-offset-4 hover:text-ledger hover:underline"
              >
                #{String(letter.agentId)}
              </Link>
            </KeyValue>
            <KeyValue label="Credit holder — receives the fee" mono>
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
        <SectionHeading
          eyebrow="do not trust this page"
          title="Verify the presentation yourself"
        >
          This fetches the document bytes exactly as they were emitted, re-hashes them in your own
          browser, and reads the examiner&apos;s answer out of the ERC-8004 Validation Registry.
        </SectionHeading>
        <Reveal className="mt-6">
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
