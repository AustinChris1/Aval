import { DEFAULT_CHAIN_ID, chainInfo, contracts } from "@/lib/chain";
import { IssueForm } from "@/components/issue-form";
import { ActionForm } from "@/components/action-form";
import { actionById } from "@/lib/actions";
import { Clause, ClauseBody, MarginNote, Sheet } from "@/components/ui";
import { DrawRule, Reveal, SplitHeadline } from "@/components/motion";
import { Mark } from "@/components/mark";
import { demoAvailable } from "@/lib/demo";

export const revalidate = 30;

const STEPS = [
  {
    n: "i",
    title: "Register an agent",
    body: "Minting an ERC-8004 identity binds the registering address as the acting wallet. Register from your own wallet and you become the agent.",
  },
  {
    n: "ii",
    title: "Issue a credit to it",
    body: "Lock value against that agent under a mandate you write. The funds sit in the credit contract, never with the agent.",
  },
  {
    n: "iii",
    title: "Try to break the mandate",
    body: "Send a payment somewhere you did not name. The chain refuses it, and records the attempt in a block anyway.",
  },
  {
    n: "iv",
    title: "Do the job and settle",
    body: "Pay a named destination, present documents, have them examined, then draw. The fee goes to the holder; the rest comes back to you.",
  },
];

export default async function IssuePage() {
  const chainId = DEFAULT_CHAIN_ID;
  const info = chainInfo(chainId);
  const c = contracts(chainId);
  const demo = demoAvailable();
  const register = actionById("register")!;

  const agentCard = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "My Agent",
    description: "Registered from the AVAL dashboard.",
    active: true,
    supportedTrust: ["reputation"],
  };
  const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(agentCard)).toString("base64")}`;

  return (
    <>
      <section className="pt-14 pb-16 sm:pt-20">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-5">
          <Mark className="size-11 shrink-0" tone="verd" />
          <div className="text-right font-mono text-[10.5px] leading-relaxed tracking-[0.14em] text-ink-faint uppercase">
            <div>Application for a documentary credit</div>
            <div className="mt-1">
              {info.name} · chain {chainId}
            </div>
          </div>
        </div>

        <h1 className="mt-12 max-w-[18ch] font-display text-[46px] leading-[1.0] tracking-[-0.02em] text-ink sm:text-[74px]">
          <SplitHeadline text="Issue one, then try to break it." />
        </h1>

        <Reveal delay={0.32} className="mt-9 max-w-[64ch]">
          <p className="text-[17px] leading-[1.65] text-ink-soft">
            Connect a wallet and hold every role at once: register an agent bound to your own key,
            write its mandate, then watch the chain refuse you the moment you step outside it.
          </p>
        </Reveal>
      </section>

      <DrawRule />

      <section className="py-20">
        <Clause n="§ 01" eyebrow="the shape of it" title="Four steps, and the whole lifecycle" />
        <ClauseBody className="mt-9">
          <div className="divide-y divide-rule border-y border-rule">
            {STEPS.map(({ n, title, body }, i) => (
              <Reveal key={title} delay={i * 0.06}>
                <div className="grid gap-x-8 gap-y-2 py-6 sm:grid-cols-[40px_minmax(0,1fr)]">
                  <span className="font-display text-[19px] leading-none text-brass/70">{n}</span>
                  <div>
                    <h3 className="font-display text-[20px] leading-tight text-ink">{title}</h3>
                    <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.7] text-ink-soft">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </ClauseBody>
      </section>

      <DrawRule />

      <section className="py-20">
        <Clause n="§ 02" eyebrow="step one" title="Register an agent">
          The address that registers becomes both the owner and the bound acting wallet, so
          registering from your own wallet lets you drive every agent action afterwards.
        </Clause>
        <ClauseBody className="mt-8">
          <ActionForm action={register} chainId={chainId} demoAvailable={demo} defaults={{ agentURI }} />
        </ClauseBody>
      </section>

      <DrawRule />

      <section className="py-20">
        <Clause n="§ 03" eyebrow="step two" title="Write the mandate">
          This is the security model, so it is worth reading rather than skipping. Every field below
          removes a class of loss, and the refusals you will see afterwards come directly from what
          you leave out of it.
        </Clause>
        <ClauseBody className="mt-8">
          <IssueForm
            chainId={chainId}
            defaults={{
              vendor: c.ServiceVendor,
              validator: "0x3c4188A91511CF42b1D8a585D9f8a566F97dE5d7",
              agentId: "0",
            }}
          />
        </ClauseBody>

        <div className="mt-8">
          <MarginNote>
            Issuing locks real value, so it is always signed by your own wallet, there is deliberately
            no demo shortcut for it. The per-role demo buttons elsewhere exist so that someone without
            tBOT can still drive an existing credit; they sign with throwaway testnet keys, are capped,
            and are refused outright on mainnet.
          </MarginNote>
        </div>
      </section>
    </>
  );
}
