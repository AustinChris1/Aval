import { formatEther } from "viem";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEFAULT_CHAIN_ID, STATUS, addressUrl, chainInfo, contracts, short } from "@/lib/chain";
import { getLetter, totalLetters } from "@/lib/indexer";
import { Addr, Clause, ClauseBody, Entry, MarginNote, SealDot, Sheet, Stamp } from "@/components/ui";
import { CountUp, DrawRule, Reveal, SplitHeadline } from "@/components/motion";
import { Mark } from "@/components/mark";

export const revalidate = 10;

const PROPERTIES = [
  {
    n: "i",
    title: "The agent never holds the money",
    body: "The credit contract custodies it. The agent submits intents, and they execute only if the mandate permits — named recipients, a named contract and method, a per-call cap, a total cap, an expiry.",
  },
  {
    n: "ii",
    title: "Payment is against documents",
    body: "The fee is reserved out of the face value and is not spendable capital. It becomes drawable only once the examiner named at issuance has scored the exact document hash presented.",
  },
  {
    n: "iii",
    title: "The credit is itself a claim",
    body: "It is an ERC-721. Whoever holds it receives the proceeds, so it can be assigned or sold — which is how documentary credits have always worked.",
  },
];

export default async function Home() {
  const chainId = DEFAULT_CHAIN_ID;
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

  const settled = letters.filter((l) => l.letter.status === 4).length;
  const open = letters.find((l) => l.letter.status === 1);
  const moved = letters.reduce((acc, l) => acc + Number(formatEther(l.letter.spent)), 0);
  const feature = open ?? letters[0];

  return (
    <>
      {/* ── letterhead ──────────────────────────────────────────────── */}
      <section className="pt-14 pb-16 sm:pt-20">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-5">
          <Mark className="size-14 shrink-0" />
          <div className="text-right font-mono text-[10.5px] leading-relaxed tracking-[0.14em] text-ink-faint uppercase">
            <div>Documentary credit · autonomous agents</div>
            <div className="mt-1">
              {info.name} · chain {chainId}
            </div>
          </div>
        </div>

        <h1 className="mt-12 max-w-[15ch] font-display text-[52px] leading-[0.98] tracking-[-0.02em] text-ink sm:text-[86px]">
          <SplitHeadline text="Someone stands" />{" "}
          <span className="brass-text">behind it.</span>
        </h1>

        <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <Reveal delay={0.32}>
            <p className="text-[17.5px] leading-[1.65] text-ink-soft">
              Agents hold wallets now, and the industry&apos;s answer to{" "}
              <em className="text-ink not-italic">what if it goes wrong</em> is a log you read
              afterwards. That is a flight recorder: it tells you how you crashed.
            </p>
            <p className="mt-5 text-[17.5px] leading-[1.65] text-ink-soft">
              Commerce solved this in the fourteenth century. An{" "}
              <span className="text-brass-soft">aval</span> is a guarantee written onto a bill of
              exchange — a third party standing behind an instrument. AVAL is that, for software with
              a wallet: value is committed against a job, an agent, a rulebook and an examiner, and
              the agent never takes custody of any of it.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              {feature && (
                <Link
                  href={`/letter/${feature.id}`}
                  className="btn-verd group inline-flex items-center gap-2 rounded-sm px-6 py-3 font-mono text-[12px] font-bold tracking-[0.16em] uppercase transition-transform duration-200 hover:-translate-y-0.5"
                >
                  {open ? "Act on the open credit" : "Replay a settled credit"}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link
                href="/issue"
                className="btn-brass inline-flex items-center gap-2 rounded-sm px-6 py-3 font-mono text-[12px] font-bold tracking-[0.16em] uppercase transition-transform duration-200 hover:-translate-y-0.5"
              >
                Issue your own
              </Link>
            </div>
          </Reveal>

          {/* the specimen: a miniature of the instrument itself */}
          {feature && (
            <Reveal delay={0.45} className="mt-12 lg:mt-0">
              <Sheet className="p-6">
                <div className="hatch pointer-events-none absolute inset-0 opacity-50" />
                <div className="relative">
                  <div className="flex items-baseline justify-between border-b border-rule pb-3">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">
                      Specimen
                    </span>
                    <span className="font-mono text-[11px] text-brass tabular-nums">
                      No. {String(feature.id).padStart(4, "0")}
                    </span>
                  </div>
                  <div className="mt-3 divide-y divide-rule/60">
                    <Entry label="Status">
                      <Stamp tone={feature.letter.status === 4 ? "ok" : "warn"}>
                        {STATUS[feature.letter.status]}
                      </Stamp>
                    </Entry>
                    <Entry label="Face value" emphasis>
                      {formatEther(feature.letter.faceValue)}
                    </Entry>
                    <Entry label="Reserved fee">{formatEther(feature.letter.fee)}</Entry>
                    <Entry label="Beneficiary">agent #{String(feature.letter.agentId)}</Entry>
                    <Entry label="Examiner">{short(feature.letter.validator, 6, 4)}</Entry>
                  </div>
                  <div className="mt-4 flex items-center gap-3 border-t border-rule pt-4">
                    <SealDot tone={feature.letter.status === 4 ? "verd" : "seal"} className="shrink-0" />
                    <span className="text-[12px] leading-snug text-ink-dim">
                      {feature.letter.status === 4
                        ? "Sealed on a compliant presentation."
                        : "Open. The seal is withheld until documents are examined."}
                    </span>
                  </div>
                </div>
              </Sheet>
            </Reveal>
          )}
        </div>
      </section>

      {/* ── the lineage: a real instrument, 1854 ─────────────────────── */}
      <section className="pb-4">
        <Reveal>
          <figure className="group relative overflow-hidden border border-rule">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/wechsel-1854.jpg"
              alt="A bill of exchange drawn in Vienna in 1854, with an engraved ornamental border and copperplate script"
              className="w-full transition-transform duration-[2.5s] ease-out [filter:sepia(0.22)_brightness(0.9)_contrast(1.03)] group-hover:scale-[1.015]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-stock-950/90 via-stock-950/10 to-stock-950/35" />
            <div className="hatch pointer-events-none absolute inset-0 opacity-30" />
            <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 p-5 sm:p-7">
              <span className="max-w-[58ch] text-[13px] leading-relaxed text-ink sm:text-[14px]">
                <span className="font-display text-[17px] text-brass-soft sm:text-[19px]">
                  Vienna, 30 October 1854.
                </span>{" "}
                A bill of exchange for one thousand gulden. The drawer names who pays, who is paid,
                how much, and by when — the same four terms an AVAL mandate writes into the chain.
              </span>
              <span className="font-mono text-[9.5px] tracking-[0.14em] text-ink-faint uppercase">
                public domain · wikimedia commons
              </span>
            </figcaption>
          </figure>
        </Reveal>
      </section>

      <DrawRule />

      {/* ── the refusal ─────────────────────────────────────────────── */}
      <section className="py-20">
        <Clause n="§ 01" eyebrow="the point" title="When the agent tried to pay itself, the chain refused">
          Not a log claiming it was stopped — a transaction, in a block, that reverted with a decoded
          reason. Every refusal here is broadcast with gas supplied by hand so it is{" "}
          <em className="text-seal not-italic">mined as reverted</em> rather than dying quietly in
          gas estimation. The applicant&apos;s money was never at risk, and there is a permanent
          record proving it.
        </Clause>

        <ClauseBody className="mt-8">
          <Sheet tone="seal" className="p-7">
            <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:repeating-linear-gradient(-45deg,var(--color-seal)_0_1px,transparent_1px_9px)]" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <SealDot className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11.5px] break-all text-seal">
                  RecipientNotAllowed(0x02366e71864cda8b9246eEf1553868Fdf1C3c629)
                </div>
                <div className="mt-2 font-mono text-[10.5px] tracking-[0.14em] text-ink-faint uppercase">
                  reverted · block 20279665 · testnet 968
                </div>
              </div>
              {feature && (
                <Link
                  href={`/letter/${feature.id}#timeline`}
                  className="group inline-flex shrink-0 items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-seal uppercase"
                >
                  See it
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </Sheet>
        </ClauseBody>

        <MarginNote>
          A safety property that lives in the agent is not a safety property. The runtime checks its
          own intent before spending gas, and the demo submits a forbidden one anyway — because if
          that check is buggy, compromised or skipped, the credit still refuses.
        </MarginNote>
      </section>

      <DrawRule />

      {/* ── the three properties ────────────────────────────────────── */}
      <section className="py-20">
        <Clause n="§ 02" eyebrow="how it holds" title="Three properties, each one a test in the repository" />
        <ClauseBody className="mt-9">
          <div className="divide-y divide-rule border-y border-rule">
            {PROPERTIES.map(({ n, title, body }, i) => (
              <Reveal key={title} delay={i * 0.07}>
                <div className="grid gap-x-8 gap-y-2 py-7 sm:grid-cols-[40px_minmax(0,1fr)]">
                  <span className="font-display text-[20px] leading-none text-brass/70">{n}</span>
                  <div>
                    <h3 className="font-display text-[21px] leading-tight text-ink">{title}</h3>
                    <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-[1.7] text-ink-soft">
                      {body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </ClauseBody>
      </section>

      <DrawRule />

      {/* ── the register ────────────────────────────────────────────── */}
      <section className="py-20">
        <Clause n="§ 03" eyebrow="read from the chain" title="The register">
          Every figure is read when this page renders. Nothing is cached in a database and nothing is
          asserted here that you cannot check on the explorer yourself.
        </Clause>

        {error && (
          <ClauseBody className="mt-6">
            <Sheet tone="seal" className="p-4 text-[13px] text-seal">
              Could not reach {info.rpc} — {error}
            </Sheet>
          </ClauseBody>
        )}

        <ClauseBody className="mt-9">
          <div className="grid gap-x-10 gap-y-8 border-y border-rule py-8 sm:grid-cols-3">
            {[
              { n: Number(total), label: "credits issued", tone: "text-ink", d: 0 },
              { n: settled, label: "settled against documents", tone: "text-verd", d: 0 },
              { n: moved, label: `${info.symbol} moved under mandate`, tone: "text-brass", d: 3 },
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
                    const status = STATUS[row.letter.status] ?? "?";
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
                            href={`/letter/${row.id}`}
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
                        Nothing issued yet —{" "}
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

      {/* ── deployment ──────────────────────────────────────────────── */}
      <section className="py-20">
        <Clause n="§ 04" eyebrow="verified source" title="Deployment" id="deployment">
          All five contracts are verified on {info.name}&apos;s Blockscout instance, so the mandate
          logic running on-chain is readable against the repository.
        </Clause>
        <ClauseBody className="mt-8">
          <div className="divide-y divide-rule/60 border-y border-rule">
            {Object.entries(c).map(([name, address]) => (
              <Entry key={name} label={name}>
                <Addr href={addressUrl(chainId, address)}>
                  <span className="hidden sm:inline">{address}</span>
                  <span className="sm:hidden">{short(address, 8, 6)}</span>
                </Addr>
              </Entry>
            ))}
          </div>
        </ClauseBody>
      </section>
    </>
  );
}
