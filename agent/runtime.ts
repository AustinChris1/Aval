// The agent runtime: propose, validate, submit, verify. The self-check is a convenience; the credit's on-chain refusal is the control, and the agent holds no funds.
import { type Address, type Hex, formatEther } from "viem";
import { encodeDocuments, type Ctx } from "../scripts/lib/context.ts";

export type Intent =
  | { kind: "payTo"; recipient: Address; amount: bigint; note: string }
  | { kind: "execute"; target: Address; value: bigint; data: Hex; note: string };

export type PreCheck = { allowed: boolean; reasons: string[] };

export class AgentRuntime {
  constructor(
    private ctx: Ctx,
    public readonly letterId: bigint,
    public readonly agentId: bigint,
  ) {}

  async letter() {
    const letter = await this.ctx.contracts.letter();
    return letter.read.getLetter([this.letterId]);
  }

  async mandate() {
    const letter = await this.ctx.contracts.letter();
    const [recipients, targets, selectors, perCallCap] = await letter.read.mandate([this.letterId]);
    return { recipients, targets, selectors, perCallCap } as {
      recipients: Address[];
      targets: Address[];
      selectors: Hex[];
      perCallCap: bigint;
    };
  }

  // Mirrors the contract's checks by reading the same public state a third party would, not a private copy that could drift.
  async validate(intent: Intent): Promise<PreCheck> {
    const letter = await this.ctx.contracts.letter();
    const [L, m, available] = await Promise.all([
      letter.read.getLetter([this.letterId]),
      this.mandate(),
      letter.read.available([this.letterId]),
    ]);
    const reasons: string[] = [];

    if (Number(L.status) !== 1) reasons.push(`credit status is ${L.status}, not Open`);
    if (BigInt(Math.floor(Date.now() / 1000)) > L.expiry) reasons.push("credit has expired");

    const amount = intent.kind === "payTo" ? intent.amount : intent.value;
    if (amount > m.perCallCap) {
      reasons.push(`${formatEther(amount)} exceeds the per-call cap of ${formatEther(m.perCallCap)}`);
    }
    if (amount > available) {
      reasons.push(`${formatEther(amount)} exceeds ${formatEther(available)} of working capital`);
    }

    if (intent.kind === "payTo") {
      const named = m.recipients.some((r) => r.toLowerCase() === intent.recipient.toLowerCase());
      if (!named) reasons.push(`${intent.recipient} is not a named recipient`);
    } else {
      const named = m.targets.some((t) => t.toLowerCase() === intent.target.toLowerCase());
      if (!named) reasons.push(`${intent.target} is not a named target`);
      const selector = (intent.data.slice(0, 10) === "0x" ? "0x00000000" : intent.data.slice(0, 10)) as Hex;
      const allowedSelector = m.selectors.some((s) => s.toLowerCase() === selector.toLowerCase());
      if (!allowedSelector) reasons.push(`selector ${selector} is not permitted`);
    }

    return { allowed: reasons.length === 0, reasons };
  }

  /** Submits an intent. Reverts if the mandate forbids it, by design. */
  async submit(intent: Intent): Promise<Hex> {
    const letter = await this.ctx.contracts.letter(this.ctx.roles.agent);
    if (intent.kind === "payTo") {
      return letter.write.payTo([this.letterId, intent.recipient, intent.amount]);
    }
    return letter.write.execute([this.letterId, intent.target, intent.value, intent.data]);
  }

  /** Confirms the submitted transaction actually succeeded on-chain. */
  async verify(hash: Hex) {
    const receipt = await this.ctx.publicClient.waitForTransactionReceipt({ hash });
    return { ok: receipt.status === "success", gasUsed: receipt.gasUsed, receipt };
  }

  // Emits the full document body on-chain so the evidence needs no pinning service; docHash is what the examiner scores.
  async present(doc: unknown, documentURI = "") {
    const { bytes, hash, json } = encodeDocuments(doc);
    const letter = await this.ctx.contracts.letter(this.ctx.roles.agent);
    const tx = await letter.write.presentDocuments([this.letterId, documentURI, hash, bytes]);
    await this.ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    return { tx, docHash: hash, json };
  }

  // Sent by the principal (owner of the agent's ERC-721): ERC-8004 requires owner or operator, and blanket approval for the credit would turn its feedback into self-feedback.
  async requestExamination(docHash: Hex, requestURI = "") {
    const validation = await this.ctx.contracts.validation(this.ctx.roles.deployer);
    const tx = await validation.write.validationRequest([
      this.ctx.address.validator,
      this.agentId,
      requestURI,
      docHash,
    ]);
    await this.ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    return tx;
  }
}
