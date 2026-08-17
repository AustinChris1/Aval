import { DEFAULT_CHAIN_ID, addressUrl, contracts } from "@/lib/chain";
import { getAgent } from "@/lib/indexer";

export const revalidate = 15;

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chainId = DEFAULT_CHAIN_ID;
  const c = contracts(chainId);
  const agent = await getAgent(chainId, BigInt(id));

  return (
    <>
      <h2>Agent #{id}</h2>
      <p className="lede">
        {agent.card?.description ??
          "An ERC-8004 agent identity. The owner is the principal; the bound wallet is the key that acts."}
      </p>

      <div className="grid three" style={{ marginTop: 18 }}>
        <div className="panel stat">
          <div className="n" style={{ color: "var(--accent)" }}>
            {agent.settledCount > 0n ? `${agent.averageScore}` : "—"}
          </div>
          <div className="l">average examined score</div>
        </div>
        <div className="panel stat">
          <div className="n">{String(agent.settledCount)}</div>
          <div className="l">settled letters</div>
        </div>
        <div className="panel stat">
          <div className="n">{agent.wallet && agent.wallet !== ZERO ? "bound" : "unbound"}</div>
          <div className="l">acting key</div>
        </div>
      </div>

      <h2>Identity</h2>
      <div className="panel">
        <div className="kv">
          <span>Name</span>
          <span>{agent.card?.name ?? "—"}</span>
        </div>
        <div className="kv">
          <span>Principal (owns the ERC-721)</span>
          <span className="mono">{agent.owner ?? "—"}</span>
        </div>
        <div className="kv">
          <span>Bound wallet (acts, custodies nothing)</span>
          <span className="mono">{agent.wallet ?? "—"}</span>
        </div>
        <div className="kv">
          <span>Identity Registry</span>
          <a
            className="mono link"
            href={addressUrl(chainId, c.IdentityRegistry)}
            target="_blank"
            rel="noreferrer"
          >
            {c.IdentityRegistry}
          </a>
        </div>
      </div>

      <h2>Why this score is hard to fake</h2>
      <div className="panel small">
        <p style={{ marginTop: 0 }}>
          The only ERC-8004 client that has written feedback for this agent is the LetterOfCredit
          contract at{" "}
          <a className="mono link" href={addressUrl(chainId, c.LetterOfCredit)} target="_blank" rel="noreferrer">
            {c.LetterOfCredit}
          </a>
          , and it can only do so for a letter that actually paid out. The score above is therefore
          backed by settled payments rather than self-assertion — the summary is filtered to that one
          client address, so reviews from anywhere else do not count towards it.
        </p>
        <p style={{ marginBottom: 0 }}>
          It is not a claim that the agent is good. It is a claim that these letters settled, that a
          named examiner scored each presentation, and that the applicant&apos;s money moved only
          where the mandate allowed.
        </p>
      </div>
    </>
  );
}

const ZERO = "0x0000000000000000000000000000000000000000";
