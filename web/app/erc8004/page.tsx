import { DEFAULT_CHAIN_ID, addressUrl, chainInfo, contracts } from "@/lib/chain";
import { getErc8004Status } from "@/lib/indexer";

export const revalidate = 30;

export default async function Erc8004Page() {
  const chainId = DEFAULT_CHAIN_ID;
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
      <h2>ERC-8004 on BOT Chain</h2>
      <p className="lede">
        BOT Chain has publicly committed to ERC-8004 (Trustless Agents), and the standard&apos;s
        canonical vanity addresses were reserved here alongside two dozen other chains. On mainnet
        those addresses hold placeholder proxies: <code>name()</code> reverts, no agent can be
        registered, and the upgrade key belongs to the ERC-8004 deployer, so nobody else can fill
        them in. The checks below run live against {info.rpc} every time this page loads.
      </p>

      {error && <div className="notice">Could not reach the RPC — {error}</div>}

      {status && (
        <>
          <h2>The canonical addresses, on mainnet 677</h2>
          <p className="small muted" style={{ marginTop: -4 }}>
            Checked live against rpc.botchain.ai. A <code>placeholder</code> badge means the address
            has code — an ERC1967 proxy — but <code>name()</code> reverts, so there is no ERC-721
            registry behind it and no agent can be registered.
          </p>
          <div className="grid two">
            <RegistryCard
              title="Canonical IdentityRegistry"
              chainId={677}
              address={status.canonicalId.address}
              deployed={status.canonicalId.deployed}
              working={status.canonicalId.working}
              note={status.canonicalId.note}
            />
            <RegistryCard
              title="Canonical ReputationRegistry"
              chainId={677}
              address={status.canonicalRep.address}
              deployed={status.canonicalRep.deployed}
              working={status.canonicalRep.working}
              note={status.canonicalRep.note}
            />
          </div>

          <h2>What LETTER deployed, on {info.name.toLowerCase()}</h2>
          <div className="grid two">
            <RegistryCard
              title="LETTER IdentityRegistry"
              chainId={chainId}
              address={c.IdentityRegistry}
              deployed={status.ourId.deployed}
              working={status.ourId.working}
              note={status.ourId.note}
            />
            <div className="panel">
              <h3>Agents actually registered</h3>
              <div className="stat">
                <div className="n" style={{ color: "var(--accent)" }}>
                  {String(status.registered)}
                </div>
                <div className="l">
                  live agents in LETTER&apos;s registry — the canonical one cannot hold any
                </div>
              </div>
            </div>
          </div>

          <h2>Why this matters</h2>
          <div className="panel small">
            <p style={{ marginTop: 0 }}>
              These are ports of the ERC-8004 reference implementation with the external ABI
              unchanged, so anything written against the canonical registries works against these.
              LETTER itself touches nothing outside the ERC-8004 interface — no private helpers, no
              extensions — which means the letter contract can be repointed at the canonical
              addresses without a code change if they are ever filled in.
            </p>
            <p>
              The integration is load-bearing, not decorative. The agent&apos;s acting key is
              resolved from the Identity Registry on every single call, so an unbound agent can move
              nothing. The Validation Registry <em>is</em> the documentary examination: no score over
              the presented hash, no payment. And reputation is written by the letter contract as the
              ERC-8004 client, only for letters that actually settled — which is why LETTER
              deliberately does not hold blanket approval over the agents it settles for, since{" "}
              <code>giveFeedback</code> rejects self-feedback from an approved operator.
            </p>
          </div>
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
  return (
    <div className="panel">
      <div className="head" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <h3>{props.title}</h3>
        <span className={`badge ${props.working ? "ok" : props.deployed ? "bad" : "warn"}`}>
          {props.working ? "working" : props.deployed ? "placeholder" : "no code"}
        </span>
      </div>
      <div className="kv">
        <span>Address</span>
        <a
          className="mono link"
          href={addressUrl(props.chainId, props.address)}
          target="_blank"
          rel="noreferrer"
        >
          {props.address}
        </a>
      </div>
      <div className="kv">
        <span>Live check</span>
        <span className="mono">{props.note}</span>
      </div>
    </div>
  );
}
