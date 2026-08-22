import { formatEther } from "viem";
import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { CHAINS, DEPLOYED_CHAIN_IDS, STATUS, addressUrl, chainInfo, contracts, short, txUrl, type ChainId } from "@/lib/chain";
import { activeChainId } from "@/lib/active-chain";
import { getLetter, getTimeline, totalLetters } from "@/lib/indexer";
import { Addr, Clause, ClauseBody, Entry, SealDot, Sheet, Stamp } from "@/components/ui";
import { CountUp, DrawRule, Reveal, SplitHeadline } from "@/components/motion";
import { HeroSpecimen } from "@/components/hero-specimen";

const TERMS = [
  { n: "01", title: "Locked, not handed over", body: "The credit holds the money. The agent only proposes." },
  { n: "02", title: "Paid against documents", body: "No examined presentation, no fee. Ever." },
  { n: "03", title: "A transferable claim", body: "The credit is an ERC-721. Whoever holds it collects." },
];

export default async function Home() {
  const chainId = await activeChainId();
  const info = chainInfo(chainId);
  const c = contracts(chainId);

  let total = 0n;
  let error: string | null = null;
  try {
    total = await totalLetters(chainId);
  } catch (e) {
    error = (e as Error).message;
  }

  const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1)).reverse();
  const letters = (
    await Promise.all(
      ids.slice(0, 25).map(async (id) => {
        try {
          return { id, ...(await getLetter(chainId, id)) };
        } catch {
          return null;
        }
      }),
    )
  ).filter((l): l is NonNullable<typeof l> => l !== null);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const settled = letters.filter((l) => l.letter.status === 4).length;
  // An Open credit past its expiry only refuses; never feature it over a live one.
  const open =
    letters.find((l) => l.letter.status === 1 && l.letter.expiry > now) ??
    letters.find((l) => l.letter.status === 1);
  const moved = letters.reduce((acc, l) => acc + Number(formatEther(l.letter.spent)), 0);
  const feature = open ?? letters[0];

  // The latest refusal becomes the hero's crimson tag: a live link to a mined revert.
  let refusalTag: { value: string; href: string } | null = null;
  if (feature) {
    try {
      const t = await getTimeline(chainId, feature.id);
      const r = [...t.rows].reverse().find((row) => row.refused);
      if (r) refusalTag = { value: r.error?.split("(")[0] ?? "refused", href: txUrl(chainId, r.hash) };
    } catch {
      refusalTag = null;
    }
  }

  const tags = feature
    ? [
        {
          label: "face value",
          value: `${formatEther(feature.letter.faceValue)} ${info.symbol} locked`,
          x: "4%",
          y: "-7%",
        },
        {
          label: "beneficiary",
          value: `agent #${String(feature.letter.agentId)}`,
          x: "66%",
          y: "16%",
        },
        {
          label: "examiner",
          value: short(feature.letter.validator, 5, 4),
          x: "10%",
          y: "72%",
        },
        ...(refusalTag
          ? [
              {
                label: "mined · reverted",
                value: refusalTag.value,
                tone: "seal" as const,
                href: refusalTag.href,
                x: "42%",
                y: "40%",
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      {/* ── hero ────────────────────────────────────────────────────── */}
      <section className="pt-16 pb-20 sm:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
          <div>
            <Reveal y={8}>
              <div className="font-mono text-[10.5px] tracking-[0.22em] text-brass uppercase">
                documentary credit · autonomous agents
              </div>
            </Reveal>

            <h1 className="mt-6 font-display text-[54px] leading-[0.98] tracking-[-0.02em] text-ink sm:text-[76px]">
              <SplitHeadline text="The agent never" />
              <br />
              <span className="brass-text">holds the money.</span>
            </h1>

            <Reveal delay={0.35} className="mt-7 max-w-[46ch]">
              <p className="text-[16.5px] leading-[1.6] text-ink-soft">
                Lock value to a job, a rulebook and an examiner. Off-mandate payments revert,
                on-chain, and the fee moves only against examined documents.
              </p>
            </Reveal>

            <Reveal delay={0.45} className="mt-9 flex flex-wrap items-center gap-3">
              {feature && (
                <Link
                  href={`/credit/${feature.id}`}
                  className="btn-verd group inline-flex items-center gap-2 rounded-sm px-6 py-3 font-mono text-[12px] font-bold tracking-[0.16em] uppercase transition-transform duration-200 hover:-translate-y-0.5"
                >
                  {open ? "Act on credit №" + String(feature.id).padStart(4, "0") : "Replay a credit"}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link
                href="/issue"
                className="btn-brass inline-flex items-center gap-2 rounded-sm px-6 py-3 font-mono text-[12px] font-bold tracking-[0.16em] uppercase transition-transform duration-200 hover:-translate-y-0.5"
              >
                Issue your own
              </Link>
            </Reveal>

            <Reveal delay={0.55} className="mt-8">
              <div className="inline-flex items-center gap-2 font-mono text-[10.5px] tracking-[0.12em] text-ink-faint uppercase">
                <CircleCheck className="size-3.5 text-verd" />
                every refusal is a mined transaction, open one
              </div>
            </Reveal>
          </div>

          <HeroSpecimen tags={tags} />
        </div>
      </section>

      {/* ── the three terms, ATLAS-style strip ──────────────────────── */}
      <DrawRule />
      <section className="py-10">
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
          {TERMS.map(({ n, title, body }, i) => (
            <Reveal key={n} delay={i * 0.07}>
              <div className="flex gap-4">
                <span className="font-display text-[22px] leading-none text-seal">{n}</span>
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">{title}</div>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{body}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <DrawRule />

      {/* ── the register ────────────────────────────────────────────── */}
      <section className="py-20">
        <Clause n="§ 01" eyebrow="read from the chain" title="The register" />
        {error && (
          <ClauseBody className="mt-6">
            <Sheet tone="seal" className="p-4 text-[13px] text-seal">
              Could not reach {info.rpc}, {error}
            </Sheet>
          </ClauseBody>
        )}

        <ClauseBody className="mt-9">
          <div className="grid gap-x-10 gap-y-8 border-y border-rule py-8 sm:grid-cols-3">
            {[
              { n: Number(total), label: "credits issued", tone: "figure-ink", d: 0 },
              { n: settled, label: "settled against documents", tone: "figure-verd", d: 0 },
              { n: moved, label: `${info.symbol} moved under mandate`, tone: "figure-brass", d: 3 },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.07}>
                <div className={`font-display text-[46px] leading-none tabular-nums ${s.tone}`}>
                  <CountUp to={s.n} decimals={s.d} />
                </div>
                <div className="mt-3 font-mono text-[10.5px] tracking-[0.14em] text-ink-faint uppercase">
                  {s.label}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rule">
                    {["No.", "Status", "Face", "Fee", "Spent", "Agent", ""].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left font-mono text-[10px] font-normal tracking-[0.16em] text-ink-faint uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {letters.map((row) => {
                    const lapsed = row.letter.status === 1 && row.letter.expiry <= now;
                    const status = lapsed ? "Expired" : (STATUS[row.letter.status] ?? "?");
                    return (
                      <tr
                        key={String(row.id)}
                        className="group border-b border-rule/50 transition-colors hover:bg-stock-800/60"
                      >
                        <td className="px-3 py-3.5 font-mono text-[13px] text-brass tabular-nums">
                          {String(row.id).padStart(4, "0")}
                        </td>
                        <td className="px-3 py-3.5">
                          <Stamp
                            tone={status === "Settled" ? "ok" : status === "Open" ? "warn" : "neutral"}
                          >
                            {status}
                          </Stamp>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[13px] text-ink tabular-nums">
                          {formatEther(row.letter.faceValue)}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[13px] text-ink-soft tabular-nums">
                          {formatEther(row.letter.fee)}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[13px] text-ink-soft tabular-nums">
                          {formatEther(row.letter.spent)}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[13px]">
                          <Link
                            href={`/agent/${row.letter.agentId}`}
                            className="text-ink-soft underline-offset-4 hover:text-verd hover:underline"
                          >
                            #{String(row.letter.agentId)}
                          </Link>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <Link
                            href={`/credit/${row.id}`}
                            className="inline-flex items-center gap-1 font-mono text-[10.5px] tracking-[0.14em] text-verd uppercase opacity-60 transition-opacity group-hover:opacity-100"
                          >
                            open
                            <ArrowRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {letters.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-[13.5px] text-ink-faint">
                        Nothing issued yet:{" "}
                        <Link href="/issue" className="text-verd underline underline-offset-4">
                          issue the first credit
                        </Link>
                        .
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Reveal>
        </ClauseBody>
      </section>

      <DrawRule />

      {/* ── the refusal, compressed ─────────────────────────────────── */}
      <section className="py-20">
        <Clause n="§ 02" eyebrow="the point" title="Refusals are mined, not logged." />
        <ClauseBody className="mt-8">
          <Sheet tone="seal" className="p-6 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <SealDot className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11.5px] break-all text-seal">
                  RecipientNotAllowed(0x02366e…C3c629)
                </div>
                <div className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                  block 20279665 · a payment the mandate did not name
                </div>
              </div>
              {feature && (
                <Link
                  href={`/credit/${feature.id}#timeline`}
                  className="group inline-flex shrink-0 items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-seal uppercase"
                >
                  See it on-chain
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </Sheet>
        </ClauseBody>
      </section>

      <DrawRule />

      {/* ── deployment ──────────────────────────────────────────────── */}
      <section className="py-20">
        <Clause n="§ 03" eyebrow="verified source" title="Deployment" id="deployment" />
        <ClauseBody className="mt-8">
          {[...DEPLOYED_CHAIN_IDS].sort((a, b) => a - b).map((cid) => (
            <div key={cid} className="mb-8 last:mb-0">
              <div className="mb-2 font-mono text-[10.5px] tracking-[0.18em] text-brass/70 uppercase">
                {CHAINS[cid as ChainId].name} · chain {cid}
              </div>
              <div className="divide-y divide-rule/60 border-y border-rule">
                {Object.entries(contracts(cid as ChainId)).map(([name, address]) => (
                  <Entry key={name} label={name}>
                    <Addr href={addressUrl(cid as ChainId, address)}>
                      <span className="hidden sm:inline">{address}</span>
                      <span className="sm:hidden">{short(address, 8, 6)}</span>
                    </Addr>
                  </Entry>
                ))}
              </div>
            </div>
          ))}
        </ClauseBody>
      </section>
    </>
  );
}
