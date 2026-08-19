import Link from "next/link";
import { ArrowLeft, BadgeCheck, Bot, KeyRound, Receipt } from "lucide-react";
import { DEFAULT_CHAIN_ID, addressUrl, contracts, short } from "@/lib/chain";
import { getAgent } from "@/lib/indexer";
import { Addr, Badge, KeyValue, Panel, SectionHeading } from "@/components/ui";
import { CountUp, DrawRule, Reveal } from "@/components/motion";

export const revalidate = 15;

const ZERO = "0x0000000000000000000000000000000000000000";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chainId = DEFAULT_CHAIN_ID;
  const c = contracts(chainId);
  const agent = await getAgent(chainId, BigInt(id));
  const bound = Boolean(agent.wallet && agent.wallet !== ZERO);

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
          <div className="flex size-11 items-center justify-center rounded-xl border border-rule bg-stock-800">
            <Bot className="size-5 text-verd" />
          </div>
          <h1 className="font-display text-[40px] leading-none tracking-[-0.015em] text-ink sm:text-[52px]">
            Agent #{id}
          </h1>
          <Badge tone={bound ? "ok" : "warn"}>
            <KeyRound className="size-3" />
            {bound ? "key bound" : "unbound"}
          </Badge>
        </Reveal>

        <Reveal delay={0.12} className="mt-5 max-w-[68ch]">
          <p className="text-[15.5px] leading-relaxed text-ink-soft">
            {agent.card?.description ??
              "An ERC-8004 agent identity. The owner is the principal; the bound wallet is the key that acts."}
          </p>
        </Reveal>

        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          <Reveal delay={0.18}>
            <Panel tone={agent.settledCount > 0n ? "verd" : "default"} className="p-6">
              <BadgeCheck className="size-4 text-verd" />
              <div className="mt-3 font-display text-[38px] leading-none text-verd">
                {agent.settledCount > 0n ? <CountUp to={Number(agent.averageScore)} /> : "—"}
              </div>
              <div className="mt-1.5 text-[13px] text-ink-faint">average examined score</div>
            </Panel>
          </Reveal>
          <Reveal delay={0.25}>
            <Panel className="p-6">
              <Receipt className="size-4 text-ink-soft" />
              <div className="mt-3 font-display text-[38px] leading-none text-ink">
                <CountUp to={Number(agent.settledCount)} />
              </div>
              <div className="mt-1.5 text-[13px] text-ink-faint">settled letters</div>
            </Panel>
          </Reveal>
          <Reveal delay={0.32}>
            <Panel className="p-6">
              <KeyRound className="size-4 text-ink-soft" />
              <div className="mt-3 font-display text-[38px] leading-none text-ink">
                {bound ? "bound" : "unbound"}
              </div>
              <div className="mt-1.5 text-[13px] text-ink-faint">
                acting key, custodies nothing
              </div>
            </Panel>
          </Reveal>
        </div>
      </section>

      <DrawRule />

      <section className="py-14">
        <SectionHeading n="§ 01" eyebrow="erc-8004" title="Identity" />
        <Reveal className="mt-6">
          <Panel className="p-6">
            <KeyValue label="Name">{agent.card?.name ?? "—"}</KeyValue>
            <KeyValue label="Principal, owns the ERC-721" mono>
              {agent.owner ? (
                <Addr href={addressUrl(chainId, agent.owner)}>
                  <span className="hidden sm:inline">{agent.owner}</span>
                  <span className="sm:hidden">{short(agent.owner, 8, 6)}</span>
                </Addr>
              ) : (
                "—"
              )}
            </KeyValue>
            <KeyValue label="Bound wallet, acts, holds nothing" mono>
              {agent.wallet ? (
                <Addr href={addressUrl(chainId, agent.wallet)}>
                  <span className="hidden sm:inline">{agent.wallet}</span>
                  <span className="sm:hidden">{short(agent.wallet, 8, 6)}</span>
                </Addr>
              ) : (
                "—"
              )}
            </KeyValue>
            <KeyValue label="Identity Registry" mono>
              <Addr href={addressUrl(chainId, c.IdentityRegistry)}>
                <span className="hidden sm:inline">{c.IdentityRegistry}</span>
                <span className="sm:hidden">{short(c.IdentityRegistry, 8, 6)}</span>
              </Addr>
            </KeyValue>
          </Panel>
        </Reveal>
      </section>

      <DrawRule />

      <section className="py-14">
        <SectionHeading n="§ 02" eyebrow="structurally" title="Why this score is hard to fake" />
        <Reveal className="mt-6">
          <Panel className="p-6 sm:p-7">
            <p className="text-[14.5px] leading-relaxed text-ink-soft">
              The only ERC-8004 client that has written feedback for this agent is the LetterOfCredit
              contract at{" "}
              <Addr href={addressUrl(chainId, c.LetterOfCredit)} className="text-[13.5px]">
                {short(c.LetterOfCredit, 10, 8)}
              </Addr>
              , and it can only do so for a credit that actually paid out. The summary above is
              filtered to that one client address, so reviews from anywhere else do not count towards
              it.
            </p>
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-soft">
              It is not a claim that the agent is good. It is a claim that these letters settled, that
              a named examiner scored each presentation, and that the applicant&apos;s money moved
              only where the mandate allowed it to.
            </p>
          </Panel>
        </Reveal>
      </section>
    </>
  );
}
