import { formatEther } from "viem";
import {
  DEFAULT_CHAIN_ID,
  STATUS,
  addressUrl,
  chainInfo,
  contracts,
  short,
} from "@/lib/chain";
import { getLetter, totalLetters } from "@/lib/indexer";

export const revalidate = 10;

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
  const letters = await Promise.all(
    ids.slice(0, 25).map(async (id) => {
      try {
        const l = await getLetter(chainId, id);
        return { id, ...l };
      } catch {
        return null;
      }
    }),
  );

  return (
    <>
      <h2>Letters of credit</h2>
      <p className="lede">
        Each letter locks value against one job, one ERC-8004 agent, one mandate and one named
        examiner. The agent never holds the funds — this contract does, and it executes the agent&apos;s
        intents only when the mandate permits them.
      </p>

      {error && (
        <div className="notice">
          Could not reach {info.rpc} — {error}
        </div>
      )}

      <div className="grid three" style={{ marginTop: 18 }}>
        <div className="panel stat">
          <div className="n">{String(total)}</div>
          <div className="l">letters issued</div>
        </div>
        <div className="panel stat">
          <div className="n">{info.name.replace("BOT Chain ", "")}</div>
          <div className="l">chain {chainId}</div>
        </div>
        <div className="panel stat">
          <div className="n">
            <a className="link" href={addressUrl(chainId, c.LetterOfCredit)} target="_blank" rel="noreferrer">
              {short(c.LetterOfCredit)}
            </a>
          </div>
          <div className="l">LetterOfCredit, verified</div>
        </div>
      </div>

      <h2>All letters</h2>
      <div className="panel" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Face value</th>
              <th>Fee</th>
              <th>Spent</th>
              <th>Agent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {letters.filter(Boolean).map((l) => {
              const row = l!;
              const status = STATUS[row.letter.status] ?? "?";
              return (
                <tr key={String(row.id)}>
                  <td className="mono">{String(row.id)}</td>
                  <td>
                    <span
                      className={`badge ${status === "Settled" ? "ok" : status === "Open" ? "warn" : ""}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="mono">{formatEther(row.letter.faceValue)}</td>
                  <td className="mono">{formatEther(row.letter.fee)}</td>
                  <td className="mono">{formatEther(row.letter.spent)}</td>
                  <td className="mono">
                    <a className="link" href={`/agent/${row.letter.agentId}`}>
                      #{String(row.letter.agentId)}
                    </a>
                  </td>
                  <td>
                    <a className="link" href={`/letter/${row.id}`}>
                      replay →
                    </a>
                  </td>
                </tr>
              );
            })}
            {letters.filter(Boolean).length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: 18 }}>
                  No letters yet. Run <code>npx hardhat run scripts/demo.ts --network botTestnet</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Deployment</h2>
      <div className="panel">
        {Object.entries(c).map(([name, address]) => (
          <div className="kv" key={name}>
            <span>{name}</span>
            <a
              className="mono link"
              href={addressUrl(chainId, address)}
              target="_blank"
              rel="noreferrer"
            >
              {address}
            </a>
          </div>
        ))}
      </div>
    </>
  );
}
