/**
 * Issues a credit and leaves it Open, so the dashboard always has a live
 * instrument for a visitor to act on.
 *
 * Without this the only letters on the site are settled ones, and every agent
 * action a visitor tries comes back BadStatus, a real refusal, but for the wrong
 * reason, which teaches them nothing about the mandate.
 *
 * The mandate here names the supplier contract and its invoice() method, and
 * names no plain recipients at all, so an attempt to pay any address produces
 * RecipientNotAllowed and an attempt at any other method produces
 * SelectorNotAllowed.
 *
 *   npx hardhat run scripts/seed-open-letter.ts --network botTestnet
 */
import { connect, banner, bot, txLink } from "./lib/context.ts";
import { parseEther, keccak256, stringToHex, toFunctionSelector, type Address } from "viem";
import { readFileSync, existsSync } from "node:fs";

const ctx = await connect();
const { publicClient, address, explorer, chainId, deployment } = ctx;

const agentStatePath = `deployments/${chainId}.agent.json`;
if (!existsSync(agentStatePath)) {
  throw new Error("Agent not registered. Run scripts/setup-agent.ts first.");
}
const agentId = BigInt((JSON.parse(readFileSync(agentStatePath, "utf8")) as { agentId: string }).agentId);

const FACE = parseEther(process.env.SEED_FACE ?? "0.08");
const FEE = parseEther(process.env.SEED_FEE ?? "0.01");
const PER_CALL = parseEther(process.env.SEED_PER_CALL ?? "0.02");
const HOURS = 72n;

banner(`Seeding an open credit on chain ${chainId}`);

const block = await publicClient.getBlock();
const letter = await ctx.contracts.letter(ctx.roles.applicant);

const tx = await letter.write.issue(
  [
    {
      agentId,
      asset: "0x0000000000000000000000000000000000000000" as Address,
      faceValue: FACE,
      fee: FEE,
      maxPerCall: PER_CALL,
      expiry: block.timestamp + HOURS * 3600n,
      disputeWindow: 0n,
      validator: address.validator,
      minScore: 75,
      termsHash: keccak256(stringToHex(`aval-open-${Date.now()}`)),
      termsURI: "",
      allowedRecipients: [] as Address[],
      allowedTargets: [deployment.contracts.ServiceVendor],
      allowedSelectors: [toFunctionSelector("invoice(bytes32)")],
    },
  ],
  { value: FACE },
);
await publicClient.waitForTransactionReceipt({ hash: tx });

const read = await ctx.contracts.letter();
const letterId = (await read.read.totalLetters()) as bigint;

console.log(`  credit #${letterId} issued and left Open`);
console.log(`  face value      ${bot(FACE)}`);
console.log(`  working capital ${bot(FACE - FEE)}`);
console.log(`  per-call cap    ${bot(PER_CALL)}`);
console.log(`  expires in      ${HOURS}h`);
console.log(`  mandate         ${deployment.contracts.ServiceVendor} · invoice(bytes32) only`);
console.log(`  no named recipients, so any plain payment is refused by construction`);
console.log(`\n  tx ${txLink(explorer, tx)}`);
console.log(`  open /credit/${letterId} on the dashboard to act on it`);
