import { formatEther } from "viem";
import { DEFAULT_CHAIN_ID, STATUS, addressUrl, txUrl, short } from "@/lib/chain";
import { getLetter, getTimeline } from "@/lib/indexer";
import { VerifyPanel } from "./verify";

export const revalidate = 10;

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chainId = DEFAULT_CHAIN_ID;
  const letterId = BigInt(id);

  const [state, timeline] = await Promise.all([
    getLetter(chainId, letterId),
    getTimeline(chainId, letterId),
  ]);

  const { letter, mandate, available, holder, docURI } = state;
  const status = STATUS[letter.status] ?? "?";
  const refusals = timeline.rows.filter((r) => r.refused).length;

  return (
    <>
      <h2>
        Letter #{id}{" "}
        <span className={`badge ${status === "Settled" ? "ok" : "warn"}`} style={{ marginLeft: 8 }}>
          {status}
        </span>
      </h2>
      <p className="lede">
        Every row below was read from the chain. The refusals are mined transactions: the agent
        asked, and the letter said no. Nothing here is a log written by the agent about itself.
      </p>

      <div className="grid three" style={{ marginTop: 18 }}>
        <div className="panel stat">
          <div className="n">{formatEther(letter.faceValue)}</div>
          <div className="l">face value locked</div>
        </div>
        <div className="panel stat">
          <div className="n">{formatEther(letter.fee)}</div>
          <div className="l">fee, reserved — not spendable</div>
        </div>
        <div className="panel stat">
          <div className="n" style={{ color: refusals ? "var(--refuse)" : undefined }}>
            {refusals}
          </div>
          <div className="l">refusals recorded on-chain</div>
        </div>
      </div>

      <h2>Timeline</h2>
      {!timeline.explorerAvailable && (
        <div className="notice">
          The explorer&apos;s transaction index is unreachable, so refused attempts cannot be listed
          right now. Successful steps come from <code>eth_getLogs</code> and are unaffected — a
          reverted call emits no logs, so there is no RPC-only way to enumerate them.
        </div>
      )}
      <div className="timeline">
        {timeline.rows.map((r) => (
          <div className={`row ${r.refused ? "refused" : ""}`} key={r.hash + r.kind}>
            <div className="head">
              <span className="title">{r.title}</span>
              <a className="tx" href={txUrl(chainId, r.hash)} target="_blank" rel="noreferrer">
                {short(r.hash, 8, 6)} ↗
              </a>
            </div>
            <div className="detail">{r.detail}</div>
            {r.error && <div className="err">reverted with {r.error}</div>}
          </div>
        ))}
        {timeline.rows.length === 0 && <div className="panel muted">No activity found.</div>}
      </div>

      <h2>The mandate</h2>
      <div className="panel">
        <div className="kv">
          <span>Per-call cap</span>
          <span className="mono">{formatEther(mandate.perCallCap)}</span>
        </div>
        <div className="kv">
          <span>Working capital left</span>
          <span className="mono">{formatEther(available)}</span>
        </div>
        <div className="kv">
          <span>Named recipients</span>
          <span className="mono">
            {mandate.recipients.length ? mandate.recipients.join(", ") : "none"}
          </span>
        </div>
        <div className="kv">
          <span>Named contracts</span>
          <span className="mono">{mandate.targets.length ? mandate.targets.join(", ") : "none"}</span>
        </div>
        <div className="kv">
          <span>Permitted methods</span>
          <span className="mono">
            {mandate.selectors.length ? mandate.selectors.join(", ") : "none"}
          </span>
        </div>
        <div className="kv">
          <span>Expiry</span>
          <span className="mono">{new Date(Number(letter.expiry) * 1000).toISOString()}</span>
        </div>
      </div>

      <h2>Parties</h2>
      <div className="panel">
        <div className="kv">
          <span>Applicant (locked the funds)</span>
          <a className="mono link" href={addressUrl(chainId, letter.applicant)} target="_blank" rel="noreferrer">
            {letter.applicant}
          </a>
        </div>
        <div className="kv">
          <span>Beneficiary agent</span>
          <a className="mono link" href={`/agent/${letter.agentId}`}>
            #{String(letter.agentId)}
          </a>
        </div>
        <div className="kv">
          <span>Credit holder (receives the fee)</span>
          <span className="mono">{holder ?? "—"}</span>
        </div>
        <div className="kv">
          <span>Examiner</span>
          <a className="mono link" href={addressUrl(chainId, letter.validator)} target="_blank" rel="noreferrer">
            {letter.validator}
          </a>
        </div>
        <div className="kv">
          <span>Required score</span>
          <span className="mono">{letter.minScore}/100</span>
        </div>
      </div>

      <h2>Verify the presentation yourself</h2>
      <VerifyPanel
        chainId={chainId}
        letterId={id}
        docHash={letter.docHash}
        docURI={docURI}
        validator={letter.validator}
        agentId={String(letter.agentId)}
        minScore={letter.minScore}
      />
    </>
  );
}
