import { formatEther } from "viem";
import Link from "next/link";
import { ArrowRight, Ban, FileCheck2, Landmark, Lock, ShieldCheck } from "lucide-react";
import { DEFAULT_CHAIN_ID, STATUS, addressUrl, chainInfo, contracts, short } from "@/lib/chain";
import { getLetter, totalLetters } from "@/lib/indexer";
import { Addr, Badge, KeyValue, Panel, SectionHeading } from "@/components/ui";
import { CountUp, DrawRule, Reveal, SplitHeadline } from "@/components/motion";

export const revalidate = 10;

const PROPERTIES = [
  {
    icon: Lock,
    title: "The agent never holds the money",
    body: "The letter contract custodies it. The agent submits intents, and they execute only if the mandate permits — named recipients, named contract and method, a per-call cap, a total cap, an expiry.",
  },
  {
    icon: FileCheck2,
    title: "Payment is against documents",
    body: "The fee is reserved out of the face value and is not spendable capital. It becomes drawable only once the examiner named at issuance has scored the exact document hash presented.",
  },
  {
    icon: Landmark,
    title: "The letter is itself a claim",
    body: "It is an ERC-721. Whoever holds it receives the proceeds, so the credit can be assigned or sold — which is how documentary credits have always worked.",
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

  return (
    <>
      {/* hero */}
      <section className="pt-20 pb-16 sm:pt-28">
        <Reveal y={10}>
          <Badge tone="ok">
            <ShieldCheck className="size-3" />
            live on {info.name}
          </Badge>
        </Reveal>

        <h1 className="mt-6 max-w-[24ch] text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-parchment sm:text-6xl">
          <SplitHeadline text="A letter of credit for AI agents." />
        </h1>

        <Reveal delay={0.35} className="mt-7 max-w-[62ch]">
          <p className="text-[16.5px] leading-relaxed text-parchment-dim">
            Agents hold wallets now, and the industry&apos;s answer to{" "}
            <em className="text-parchment not-italic">what if it goes wrong</em> is a log you read
            afterwards. That is a flight recorder: it tells you how you crashed.
          </p>
          <p className="mt-4 text-[16.5px] leading-relaxed text-parchment-dim">
            Commerce solved this in the fourteenth century. Lock funds against a job, an agent, a
            rulebook and an examiner — and the counterparty never takes custody at all.
          </p>
        </Reveal>

        <Reveal delay={0.5} className="mt-9 flex flex-wrap items-center gap-3">
          {letters[0] && (
            <Link
              href={`/letter/${letters[0].id}`}
              className="group inline-flex items-center gap-2 rounded-lg bg-ledger px-5 py-2.5 text-[14px] font-semibold text-ink-950 transition-transform duration-200 hover:-translate-y-0.5"
            >
              Replay a settled letter
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <Link
            href="/erc8004"
            className="inline-flex items-center gap-2 rounded-lg border border-line px-5 py-2.5 text-[14px] text-parchment transition-colors hover:border-line-bright hover:bg-ink-800"
          >
            The ERC-8004 gap
          </Link>
        </Reveal>
      </section>

      <DrawRule />

      {/* the refusal, stated up front — it is the product */}
      <section className="py-16">
        <Reveal>
          <Panel tone="seal" className="overflow-hidden p-7 sm:p-9">
            <div className="flex items-start gap-4">
              <Ban className="mt-0.5 size-5 shrink-0 animate-pulse-seal text-seal" />
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-parchment sm:text-xl">
                  When the agent tried to pay itself, the chain refused
                </h2>
                <p className="mt-3 max-w-[66ch] text-[14.5px] leading-relaxed text-parchment-dim">
                  Not a log claiming it was stopped — a transaction, in a block, that reverted with a
                  decoded reason. Every refusal on this site is broadcast with gas supplied manually
                  so it is <em className="text-seal not-italic">mined as reverted</em> rather than
                  dying quietly in gas estimation. The applicant&apos;s money was never at risk, and
                  there is a permanent record proving it.
                </p>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* the three properties */}
      <section className="pb-16">
        <SectionHeading eyebrow="how it holds" title="Three properties, each one a test in the repo" />
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {PROPERTIES.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <Panel className="group h-full p-6 hover:border-line-bright">
                <Icon className="size-5 text-ledger transition-transform duration-300 group-hover:-translate-y-0.5" />
                <h3 className="mt-4 text-[15px] font-semibold text-parchment">{title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-parchment-dim">{body}</p>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>

      <DrawRule />

      {/* live figures */}
      <section className="py-16">
        <SectionHeading eyebrow="read from the chain" title="Live state" />
        {error && (
          <Panel tone="seal" className="mt-5 p-4 text-[13px] text-seal">
            Could not reach {info.rpc} — {error}
          </Panel>
        )}
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {[
            { n: Number(total), label: "letters issued", tone: "text-parchment" },
            { n: settled, label: "settled against documents", tone: "text-ledger" },
            {
              n: letters.reduce((acc, l) => acc + Number(formatEther(l.letter.spent)), 0),
              label: "BOT moved under mandate",
              tone: "text-parchment",
              decimals: 2,
            },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.07}>
              <Panel className="p-6">
                <div className={`text-3xl font-semibold tracking-[-0.02em] ${s.tone}`}>
                  <CountUp to={s.n} decimals={s.decimals ?? 0} />
                </div>
                <div className="mt-1.5 text-[13px] text-parchment-faint">{s.label}</div>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>

      {/* letters table */}
      <section className="pb-16">
        <SectionHeading eyebrow="the instruments" title="All letters" />
        <Reveal className="mt-6">
          <Panel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-line">
                    {["#", "Status", "Face value", "Fee", "Spent", "Agent", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-medium tracking-[0.08em] text-parchment-faint uppercase"
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
                        className="group border-b border-line/60 transition-colors last:border-0 hover:bg-ink-750/60"
                      >
                        <td className="px-4 py-3.5 font-mono text-parchment-dim">{String(row.id)}</td>
                        <td className="px-4 py-3.5">
                          <Badge
                            tone={status === "Settled" ? "ok" : status === "Open" ? "warn" : "neutral"}
                          >
                            {status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-parchment">
                          {formatEther(row.letter.faceValue)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-parchment-dim">
                          {formatEther(row.letter.fee)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-parchment-dim">
                          {formatEther(row.letter.spent)}
                        </td>
                        <td className="px-4 py-3.5 font-mono">
                          <Link
                            href={`/agent/${row.letter.agentId}`}
                            className="text-parchment-dim underline-offset-4 hover:text-ledger hover:underline"
                          >
                            #{String(row.letter.agentId)}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/letter/${row.id}`}
                            className="inline-flex items-center gap-1 text-[13px] text-ledger opacity-70 transition-opacity group-hover:opacity-100"
                          >
                            replay
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {letters.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-[13.5px] text-parchment-faint">
                        No letters yet. Run{" "}
                        <code className="rounded bg-ink-750 px-1.5 py-0.5 font-mono text-[12.5px]">
                          npx hardhat run scripts/demo.ts --network botTestnet
                        </code>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* deployment */}
      <section className="pb-8">
        <SectionHeading
          eyebrow="verified source"
          title="Deployment"
          id="deployment"
        >
          All five contracts are verified on {info.name}&apos;s Blockscout instance, so the mandate
          logic running on-chain is readable against the repo.
        </SectionHeading>
        <Reveal className="mt-6">
          <Panel className="p-6">
            {Object.entries(c).map(([name, address]) => (
              <KeyValue key={name} label={name} mono>
                <Addr href={addressUrl(chainId, address)}>
                  <span className="hidden sm:inline">{address}</span>
                  <span className="sm:hidden">{short(address, 8, 6)}</span>
                </Addr>
              </KeyValue>
            ))}
          </Panel>
        </Reveal>
      </section>
    </>
  );
}
