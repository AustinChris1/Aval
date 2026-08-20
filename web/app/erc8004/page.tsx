import { CircleSlash, KeyRound, Radio, ShieldCheck, TriangleAlert } from "lucide-react";
import { CHAINS, addressUrl, chainInfo, contracts } from "@/lib/chain";
import { activeChainId } from "@/lib/active-chain";
import { getErc8004Status } from "@/lib/indexer";
import { Addr, Badge, KeyValue, Panel, SectionHeading } from "@/components/ui";
import { CountUp, DrawRule, Reveal, SplitHeadline } from "@/components/motion";

export default async function Erc8004Page() {
  const chainId = await activeChainId();
  const info = chainInfo(chainId);
  const c = contracts(chainId);

  let status: Awaited<ReturnType<typeof getErc8004Status>> | null = null;
  let error: string | null = null;
  try {
    status = await getErc8004Status(chainId);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <section className="pt-14 pb-12">
        <Reveal y={8}>
          <Badge tone="warn">
            <Radio className="size-3" />
            checked live, every page load
          </Badge>
        </Reveal>

        <h1 className="mt-6 max-w-[24ch] font-display text-[42px] leading-[1.05] tracking-[-0.015em] text-ink sm:text-[62px]">
          <SplitHeadline text="ERC-8004 is announced on BOT Chain, and not usable on it." />
        </h1>

        <Reveal delay={0.35} className="mt-6 max-w-[68ch]">
          <p className="text-[16px] leading-relaxed text-ink-soft">
            BOT Chain has publicly committed to ERC-8004 (Trustless Agents), and the standard&apos;s
            canonical vanity addresses were reserved here alongside roughly two dozen other chains.
            On mainnet those addresses hold placeholder proxies: <code>name()</code> reverts, no agent
            can be registered, and the upgrade key belongs to the ERC-8004 deployer, so nobody else
            can fill them in.
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
            The two checks below are not screenshots. They run against{" "}
            <span className="font-mono text-[14.5px] text-ink">rpc.botchain.ai</span> when this
            page renders.
          </p>
        </Reveal>
      </section>

      {error && (
        <Panel tone="seal" className="mb-10 flex items-start gap-2 p-4 text-[13px] text-seal">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Could not reach the RPC, {error}
        </Panel>
      )}

      {status && (
        <>
          <DrawRule />

          <section className="py-14">
            <SectionHeading
              n="§ 01" eyebrow="reserved, not shipped"
              title="The canonical addresses, on mainnet 677"
            >
              A <span className="text-seal">placeholder</span> verdict means the address has code, an
              ERC1967 proxy, but <code>name()</code> reverts, so there is no ERC-721 registry behind
              it and no agent can ever be registered against it.
            </SectionHeading>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <Reveal delay={0}>
                <RegistryCard
                  title="Canonical IdentityRegistry"
                  chainId={677}
                  {...status.canonicalId}
                />
              </Reveal>
              <Reveal delay={0.08}>
                <RegistryCard
                  title="Canonical ReputationRegistry"
                  chainId={677}
                  {...status.canonicalRep}
                />
              </Reveal>
            </div>
          </section>

          <DrawRule />

          <section className="py-14">
            <SectionHeading
              n="§ 02" eyebrow="working, today"
              title={`What AVAL deployed on ${status ? CHAINS[status.ourChainId].name : info.name}`}
            >
              Ports of the ERC-8004 reference implementation with the external ABI unchanged, so
              anything written against the canonical registries works against these.
            </SectionHeading>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <Reveal>
                <RegistryCard
                  title="AVAL IdentityRegistry"
                  chainId={status.ourChainId}
                  address={contracts(status.ourChainId).IdentityRegistry}
                  deployed={status.ourId.deployed}
                  working={status.ourId.working}
                  note={status.ourId.note}
                />
              </Reveal>
              <Reveal delay={0.08}>
                <Panel tone="verd" className="flex h-full flex-col justify-between p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-semibold text-ink">
                      Agents actually registered
                    </h3>
                    <Badge tone="ok">
                      <ShieldCheck className="size-3" />
                      live
                    </Badge>
                  </div>
                  <div className="mt-6">
                    <div className="font-display text-[46px] leading-none text-verd">
                      <CountUp to={Number(status.registered)} />
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                      live agent identities in AVAL&apos;s registry. The canonical one cannot hold a
                      single one.
                    </p>
                  </div>
                </Panel>
              </Reveal>
            </div>
          </section>

          <DrawRule />

          <section className="py-14">
            <SectionHeading n="§ 03" eyebrow="not decorative" title="Where the standard is load-bearing" />
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: KeyRound,
                  title: "Identity gates every call",
                  body: "The agent's acting key is resolved from the Identity Registry on each individual call, not pinned at issuance. An unbound agent can move nothing at all.",
                },
                {
                  icon: ShieldCheck,
                  title: "Validation is the examination",
                  body: "The Validation Registry is not a badge, it is the documentary examination itself. No score over the presented hash, from the named examiner, at or above threshold: no payment.",
                },
                {
                  icon: CircleSlash,
                  title: "Reputation is payment-backed",
                  body: "The letter contract writes feedback as the ERC-8004 client, only for letters that settled. It deliberately holds no blanket approval over agents, because giveFeedback rejects self-feedback from an approved operator.",
                },
              ].map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 0.08}>
                  <Panel className="h-full p-6">
                    <Icon className="size-5 text-verd" />
                    <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
                    <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">{body}</p>
                  </Panel>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.2} className="mt-6">
              <Panel className="p-6">
                <p className="text-[14px] leading-relaxed text-ink-soft">
                  Because AVAL touches nothing outside the ERC-8004 interface, no private helpers,
                  no extensions, so the credit contract can be repointed at the canonical addresses
                  without a code change, the day someone fills them in.
                </p>
              </Panel>
            </Reveal>
          </section>
        </>
      )}
    </>
  );
}

function RegistryCard(props: {
  title: string;
  chainId: 968 | 677;
  address: string;
  deployed: boolean;
  working: boolean;
  note: string;
}) {
  const verdict = props.working ? "working" : props.deployed ? "placeholder" : "no code";
  const tone = props.working ? "ok" : props.deployed ? "bad" : "warn";

  return (
    <Panel tone={props.working ? "verd" : props.deployed ? "seal" : "default"} className="h-full p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{props.title}</h3>
        <Badge tone={tone as "ok" | "bad" | "warn"}>{verdict}</Badge>
      </div>
      <div className="mt-4">
        <KeyValue label="Address" mono>
          <Addr href={addressUrl(props.chainId, props.address)}>{props.address}</Addr>
        </KeyValue>
        <KeyValue label="Live check" mono>
          {props.note}
        </KeyValue>
      </div>
    </Panel>
  );
}
