// The examiner: re-derives every claim from chain state itself; the score it writes to the Validation Registry is what the credit reads at settlement.
import { type Address, type Hex, formatEther, keccak256, stringToHex } from "viem";
import type { Ctx } from "../scripts/lib/context.ts";

export type Finding = { check: string; ok: boolean; detail: string };

export type Examination = {
  score: number;
  findings: Finding[];
  summary: string;
};

/** What the agent is expected to have produced for the supplier-payment job. */
export type PresentedDocuments = {
  job: string;
  letterId: string;
  invoiceRef: string;
  paidTo: Address;
  amount: string;
  txHash?: Hex;
};

export class Examiner {
  constructor(private ctx: Ctx) {}

  // Each check is an equal share of 100, so a partial failure yields a partial score rather than an opaque rejection.
  async examine(letterId: bigint, docs: PresentedDocuments, docHash: Hex): Promise<Examination> {
    const findings: Finding[] = [];
    const letterContract = await this.ctx.contracts.letter();
    const vendor = await this.ctx.contracts.vendor();
    const L = await letterContract.read.getLetter([letterId]);

    // 1. The documents must be the ones the credit actually recorded.
    const recomputed = keccak256(stringToHex(JSON.stringify(docs)));
    findings.push({
      check: "document integrity",
      ok: recomputed.toLowerCase() === docHash.toLowerCase() && L.docHash.toLowerCase() === docHash.toLowerCase(),
      detail: `presented hash ${docHash.slice(0, 18)}… matches the credit's record`,
    });

    // 2. The claimed payee must be one the applicant named in the mandate.
    const named = await letterContract.read.isAllowedRecipient([letterId, docs.paidTo]);
    const namedTarget = await letterContract.read.isAllowedTarget([letterId, docs.paidTo]);
    findings.push({
      check: "payee under mandate",
      ok: Boolean(named || namedTarget),
      detail: `${docs.paidTo} is a destination the applicant named`,
    });

    // 3. The invoice must exist on the supplier's own books, read from the counterparty, not from the agent.
    const ref = docs.invoiceRef as Hex;
    const invoice = (await vendor.read.invoices([ref])) as unknown as [Address, bigint, bigint];
    const [payer, amount, paidAt] = invoice;
    const expected = BigInt(docs.amount);
    const invoiceOk =
      paidAt > 0n &&
      amount === expected &&
      payer.toLowerCase() === this.ctx.deployment.contracts.LetterOfCredit.toLowerCase();
    findings.push({
      check: "invoice settled at the supplier",
      ok: invoiceOk,
      detail: paidAt > 0n
        ? `supplier recorded ${formatEther(amount)} BOT from ${payer.slice(0, 10)}…`
        : "supplier has no record of this invoice",
    });

    // 4. The credit's own accounting must agree with the claim.
    const spentOk = L.spent >= expected;
    findings.push({
      check: "credit accounting",
      ok: spentOk,
      detail: `credit records ${formatEther(L.spent)} BOT spent against a claim of ${formatEther(expected)}`,
    });

    const passed = findings.filter((f) => f.ok).length;
    const score = Math.round((passed / findings.length) * 100);
    const summary =
      passed === findings.length
        ? "compliant presentation"
        : `discrepancy: ${findings.filter((f) => !f.ok).map((f) => f.check).join(", ")}`;

    return { score, findings, summary };
  }

  /** Writes the examination to the ERC-8004 Validation Registry. */
  async respond(docHash: Hex, exam: Examination, responseURI = "") {
    const validation = await this.ctx.contracts.validation(this.ctx.roles.validator);
    const responseHash = keccak256(stringToHex(JSON.stringify(exam)));
    const tx = await validation.write.validationResponse([
      docHash,
      exam.score,
      responseURI,
      responseHash,
      "aval",
    ]);
    await this.ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    return { tx, responseHash };
  }
}
