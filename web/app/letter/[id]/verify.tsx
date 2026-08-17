"use client";

import { useState } from "react";
import { keccak256, hexToString, type Hex } from "viem";
import type { ChainId } from "@/lib/chain";

type Result = {
  documents: Hex | null;
  storedDocHash: Hex;
  expectedValidator: string;
  expectedAgentId: string;
  minScore: number;
  validation: { validator: string; agentId: string; response: number; exists: boolean };
};

type Check = { label: string; ok: boolean; detail: string };

export function VerifyPanel(props: {
  chainId: ChainId;
  letterId: string;
  docHash: Hex;
  docURI: string;
  validator: string;
  agentId: string;
  minScore: number;
}) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/presentation?letterId=${props.letterId}`);
      const data = (await res.json()) as Result & { error?: string };
      if (data.error) throw new Error(data.error);

      const out: Check[] = [];

      // 1. Recompute the hash here, in this browser, from the emitted bytes.
      if (data.documents && data.documents !== "0x") {
        const recomputed = keccak256(data.documents);
        out.push({
          label: "Document body hashes to the committed hash",
          ok: recomputed.toLowerCase() === data.storedDocHash.toLowerCase(),
          detail: `keccak256(documents) = ${recomputed}`,
        });
        try {
          setBody(JSON.stringify(JSON.parse(hexToString(data.documents)), null, 2));
        } catch {
          setBody(hexToString(data.documents));
        }
      } else {
        out.push({
          label: "Document body present on-chain",
          ok: false,
          detail: "hash-only presentation; the body is held off-chain",
        });
      }

      // 2. The examination must be by the examiner named at issuance…
      out.push({
        label: "Examined by the examiner named at issuance",
        ok:
          data.validation.exists &&
          data.validation.validator.toLowerCase() === data.expectedValidator.toLowerCase(),
        detail: data.validation.exists
          ? `${data.validation.validator}`
          : "no examination has been opened over this hash",
      });

      // 3. …of this letter's agent…
      out.push({
        label: "Examination is of this letter's agent",
        ok: data.validation.exists && data.validation.agentId === data.expectedAgentId,
        detail: data.validation.exists
          ? `agent #${data.validation.agentId} (letter names #${data.expectedAgentId})`
          : "—",
      });

      // 4. …at or above the threshold written into the letter.
      out.push({
        label: "Score meets the letter's threshold",
        ok: data.validation.exists && data.validation.response >= data.minScore,
        detail: `${data.validation.response}/100, threshold ${data.minScore}`,
      });

      setChecks(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const allOk = checks?.every((c) => c.ok);

  return (
    <div className="panel">
      <p className="small muted" style={{ marginTop: 0 }}>
        This fetches the document bytes as they were emitted and re-hashes them in your browser,
        then reads the examiner&apos;s answer out of the ERC-8004 Validation Registry. Nothing is
        taken on trust from this page.
      </p>

      <button
        onClick={run}
        disabled={busy}
        style={{
          background: "var(--accent)",
          color: "#0b0d10",
          border: 0,
          borderRadius: 7,
          padding: "9px 16px",
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          fontSize: 14,
        }}
      >
        {busy ? "Checking…" : "Verify this presentation"}
      </button>

      {error && <div className="notice" style={{ marginTop: 14 }}>{error}</div>}

      {checks && (
        <>
          <div style={{ marginTop: 16 }}>
            {checks.map((c) => (
              <div className="kv" key={c.label}>
                <span>
                  <span className={`badge ${c.ok ? "ok" : "bad"}`} style={{ marginRight: 8 }}>
                    {c.ok ? "pass" : "fail"}
                  </span>
                  {c.label}
                </span>
                <span className="mono" style={{ textAlign: "right", wordBreak: "break-all" }}>
                  {c.detail}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <span className={`badge ${allOk ? "ok" : "bad"}`}>
              {allOk ? "compliant presentation" : "discrepancy"}
            </span>
          </div>
        </>
      )}

      {body && (
        <>
          <h3 style={{ marginTop: 22 }}>The documents, as emitted on-chain</h3>
          <pre
            className="mono"
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 14,
              overflowX: "auto",
              fontSize: 12.5,
            }}
          >
            {body}
          </pre>
        </>
      )}
    </div>
  );
}
