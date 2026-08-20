/**
 * The full LETTER lifecycle, end to end, on a live network.
 *
 * Narrative:
 *   1. An applicant locks BOT against a job, an agent, a mandate and an examiner.
 *   2. The agent tries to pay itself.        -> the chain refuses
 *   3. The agent tries a forbidden method.   -> the chain refuses
 *   4. The agent does the permitted job.     -> settled at the supplier
 *   5. The agent presents documents.
 *   6. The examiner re-derives every claim from chain state and scores it.
 *   7. The credit is drawn: fee to the holder, unspent capital back to the applicant.
 *   8. Reputation is written that only a settled credit could have produced.
 *
 * Steps 2 and 3 are broadcast with explicit gas so they are *mined as reverted*
 * rather than dying in local estimation. The refusals become permanent,
 * inspectable transactions, that is the evidence, not a log line.
 *
 *   npx hardhat run scripts/demo.ts --network botTestnet
 */
import {
  connect,
  banner,
  bot,
  txLink,
  addrLink,
  sendExpectedRejection,
} from "./lib/context.ts";
import { AgentRuntime } from "../agent/runtime.ts";
import { Examiner, type PresentedDocuments } from "../agent/examiner.ts";
import {
  parseEther,
  keccak256,
  stringToHex,
  encodeFunctionData,
  toFunctionSelector,
  formatEther,
  type Address,
  type Hex,
} from "viem";
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const ctx = await connect();
const { publicClient, address, explorer, chainId, deployment } = ctx;

const agentStatePath = `deployments/${chainId}.agent.json`;
if (!existsSync(agentStatePath)) {
  throw new Error(`Agent not registered. Run: npx hardhat run scripts/setup-agent.ts --network ${chainId === 677 ? "botMainnet" : "botTestnet"}`);
}
const agentId = BigInt((JSON.parse(readFileSync(agentStatePath, "utf8")) as { agentId: string }).agentId);

const receipts: { step: string; hash?: Hex; outcome: string }[] = [];
const record = (step: string, hash: Hex | undefined, outcome: string) => {
  receipts.push({ step, hash, outcome });
  console.log(`    ${outcome.padEnd(26)} ${hash ? txLink(explorer, hash) : "(not mined by this node)"}`);
};

// --- 0. context ----------------------------------------------------------

banner(`LETTER on BOT Chain ${chainId}, full lifecycle`);
console.log(`applicant  ${address.applicant}   ${bot(await publicClient.getBalance({ address: address.applicant }))}`);
console.log(`principal  ${address.deployer}   (owns agent #${agentId})`);
console.log(`agent      ${address.agent}   ${bot(await publicClient.getBalance({ address: address.agent }))}  custodies nothing`);
console.log(`examiner   ${address.validator}`);
console.log(`letter     ${addrLink(explorer, deployment.contracts.LetterOfCredit)}`);

// --- 1. issue ------------------------------------------------------------

// Tunable so the mainnet run can be small; the argument never depends on size.
const FACE = parseEther(process.env.DEMO_FACE ?? "0.5");
const FEE = parseEther(process.env.DEMO_FEE ?? "0.05");
const PER_CALL = parseEther(process.env.DEMO_PER_CALL ?? "0.2");
const JOB_AMOUNT = PER_CALL;
const INVOICE_SELECTOR = toFunctionSelector("invoice(bytes32)");
const invoiceRef = keccak256(stringToHex(`invoice-${Date.now()}`));

banner("1. The applicant issues a credit");

const terms = {
  job: "Settle approved supplier invoice",
  supplier: deployment.contracts.ServiceVendor,
  invoiceRef,
  maxTotal: formatEther(FACE - FEE),
  maxPerCall: formatEther(PER_CALL),
  fee: formatEther(FEE),
  examinationThreshold: 75,
};
const termsHash = keccak256(stringToHex(JSON.stringify(terms)));

const block = await publicClient.getBlock();
const letterAsApplicant = await ctx.contracts.letter(ctx.roles.applicant);

const issueTx = await letterAsApplicant.write.issue(
  [
    {
      agentId,
      asset: "0x0000000000000000000000000000000000000000" as Address,
      faceValue: FACE,
      fee: FEE,
      maxPerCall: PER_CALL,
      expiry: block.timestamp + 3600n,
      disputeWindow: 0n,
      validator: address.validator,
      minScore: 75,
      termsHash,
      termsURI: "",
      // The mandate: the supplier contract, and only its invoice() method.
      // No recipient is named at all, so a bare transfer has nowhere to go.
      allowedRecipients: [] as Address[],
      allowedTargets: [deployment.contracts.ServiceVendor],
      allowedSelectors: [INVOICE_SELECTOR],
    },
  ],
  { value: FACE },
);
await publicClient.waitForTransactionReceipt({ hash: issueTx });

const letterRead = await ctx.contracts.letter();
const letterId = (await letterRead.read.totalLetters()) as bigint;
record("issue", issueTx, "credit issued");

console.log(`\n  credit #${letterId}`);
console.log(`  face value        ${bot(FACE)}   locked in the credit contract`);
console.log(`  working capital   ${bot(FACE - FEE)}   spendable under mandate`);
console.log(`  reserved fee      ${bot(FEE)}   payable only on a compliant presentation`);
console.log(`  per-call cap      ${bot(PER_CALL)}`);
console.log(`  mandate           target ${deployment.contracts.ServiceVendor}`);
console.log(`                    selector ${INVOICE_SELECTOR} (invoice(bytes32)) only`);
console.log(`  credit holder     ${await letterRead.read.ownerOf([letterId])}`);

const agent = new AgentRuntime(ctx, letterId, agentId);
const vendor = await ctx.contracts.vendor();

// --- 2. the agent tries to pay itself -----------------------------------

banner("2. The agent tries to pay itself");

const theft = {
  kind: "payTo" as const,
  recipient: address.agent,
  amount: PER_CALL,
  note: "divert working capital to the agent's own key",
};
const theftCheck = await agent.validate(theft);
console.log(`  agent's own pre-check: ${theftCheck.allowed ? "allowed" : "refused"}`);
for (const r of theftCheck.reasons) console.log(`    - ${r}`);
console.log("\n  submitting anyway, because the pre-check is not what protects the applicant:");

const blockedTheft = await sendExpectedRejection(ctx, ctx.roles.agent, {
  address: deployment.contracts.LetterOfCredit,
  abi: letterRead.abi,
  functionName: "payTo",
  args: [letterId, address.agent, PER_CALL],
});
console.log(`  the credit refused it: ${blockedTheft.error}`);
record(
  "blocked-theft",
  blockedTheft.hash,
  blockedTheft.mined ? "REFUSED, recorded on-chain" : "REFUSED at submission",
);

// --- 3. the agent tries a forbidden method on an allowed contract -------

banner("3. The agent tries a forbidden method on the approved supplier");

const drainData = encodeFunctionData({
  abi: vendor.abi,
  functionName: "withdraw",
  args: [address.agent],
});
const blockedSelector = await sendExpectedRejection(ctx, ctx.roles.agent, {
  address: deployment.contracts.LetterOfCredit,
  abi: letterRead.abi,
  functionName: "execute",
  args: [letterId, deployment.contracts.ServiceVendor, 0n, drainData],
});
console.log(`  the target is approved; the method is not.`);
console.log(`  the credit refused it: ${blockedSelector.error}`);
record(
  "blocked-selector",
  blockedSelector.hash,
  blockedSelector.mined ? "REFUSED, recorded on-chain" : "REFUSED at submission",
);

// --- 4. the permitted job ------------------------------------------------

banner("4. The agent does the job it was mandated to do");

const invoiceData = encodeFunctionData({
  abi: vendor.abi,
  functionName: "invoice",
  args: [invoiceRef],
});
const job = {
  kind: "execute" as const,
  target: deployment.contracts.ServiceVendor,
  value: JOB_AMOUNT,
  data: invoiceData,
  note: "settle the approved supplier invoice",
};
const jobCheck = await agent.validate(job);
console.log(`  pre-check: ${jobCheck.allowed ? "inside the mandate" : "refused"}`);

const jobTx = await agent.submit(job);
const jobResult = await agent.verify(jobTx);
record("job", jobTx, jobResult.ok ? "supplier paid" : "failed");

const supplierBalance = await publicClient.getBalance({ address: deployment.contracts.ServiceVendor });
console.log(`\n  supplier now holds  ${bot(supplierBalance)}`);
console.log(`  credit capital left ${bot((await letterRead.read.available([letterId])) as bigint)}`);

// --- 5. presentation -----------------------------------------------------

banner("5. The agent presents its documents");

const documents: PresentedDocuments = {
  job: "Settle approved supplier invoice",
  letterId: letterId.toString(),
  invoiceRef,
  paidTo: deployment.contracts.ServiceVendor,
  amount: JOB_AMOUNT.toString(),
  txHash: jobTx,
};
const presentation = await agent.present(documents, "");
record("presentation", presentation.tx, "documents on-chain");
console.log(`\n  document hash ${presentation.docHash}`);
console.log(`  the body is in the event data, readable on the explorer with nothing else to trust.`);

const examRequestTx = await agent.requestExamination(presentation.docHash, "");
record("exam-request", examRequestTx, "examination requested");

// --- 6. examination ------------------------------------------------------

banner("6. The examiner re-derives every claim from chain state");

const examiner = new Examiner(ctx);
const exam = await examiner.examine(letterId, documents, presentation.docHash);
for (const f of exam.findings) {
  console.log(`  [${f.ok ? "pass" : "FAIL"}] ${f.check.padEnd(30)} ${f.detail}`);
}
console.log(`\n  score ${exam.score}/100, ${exam.summary}`);

const response = await examiner.respond(presentation.docHash, exam, "");
record("examination", response.tx, `scored ${exam.score}/100`);

// --- 7. settlement -------------------------------------------------------

banner("7. Settlement, payment against documents");

const holder = (await letterRead.read.ownerOf([letterId])) as Address;
const holderBefore = await publicClient.getBalance({ address: holder });
const applicantBefore = await publicClient.getBalance({ address: address.applicant });

// Permissionless: every condition is on-chain, so any key can settle.
const letterAsAgent = await ctx.contracts.letter(ctx.roles.agent);
const drawTx = await letterAsAgent.write.draw([letterId]);
await publicClient.waitForTransactionReceipt({ hash: drawTx });
record("draw", drawTx, "credit drawn");

const holderAfter = await publicClient.getBalance({ address: holder });
const applicantAfter = await publicClient.getBalance({ address: address.applicant });
const finalLetter = await letterRead.read.getLetter([letterId]);

console.log(`\n  fee to credit holder      +${bot(holderAfter - holderBefore)}  (${holder})`);
console.log(`  returned to applicant     +${bot(applicantAfter - applicantBefore)}`);
console.log(`  letter contract balance    ${bot(await publicClient.getBalance({ address: deployment.contracts.LetterOfCredit }))}`);
console.log(`  status                     ${["None", "Open", "Presented", "Disputed", "Settled", "Refunded", "Cancelled"][Number(finalLetter.status)]}`);

// --- 8. reputation -------------------------------------------------------

banner("8. Reputation that only a settled credit could have written");

const reputation = await ctx.contracts.reputation();
const [count, value] = (await reputation.read.getSummary([
  agentId,
  [deployment.contracts.LetterOfCredit],
  "letter.settled",
  "",
])) as unknown as [bigint, bigint, number];

console.log(`  settled letters for agent #${agentId}: ${count}`);
console.log(`  average examined score:              ${value}/100`);
console.log(`\n  The only client that can write this feedback is the credit contract,`);
console.log(`  and it can only do so for a credit that actually paid out.`);

// --- summary -------------------------------------------------------------

banner("Receipts");
for (const r of receipts) {
  console.log(
    `  ${r.step.padEnd(18)} ${r.outcome.padEnd(28)} ${r.hash ? txLink(explorer, r.hash) : "—"}`,
  );
}

const summaryPath = `deployments/${chainId}.demo.json`;
writeFileSync(
  summaryPath,
  `${JSON.stringify(
    { chainId, letterId: letterId.toString(), agentId: agentId.toString(), score: exam.score, receipts },
    null,
    2,
  )}\n`,
);
console.log(`\nwrote ${summaryPath}`);
const minedRefusals = receipts.filter((r) => r.step.startsWith("blocked") && r.hash).length;
if (minedRefusals > 0) {
  console.log(`\nThe ${minedRefusals} refusals above are mined transactions. Open them: the`);
  console.log(`applicant's money was never at risk, and there is a permanent record of that.`);
} else {
  console.log(`\nThis node rejects failing transactions at submission rather than mining them,`);
  console.log(`so the refusals have no hash here. On BOT Chain they are mined and inspectable.`);
}
