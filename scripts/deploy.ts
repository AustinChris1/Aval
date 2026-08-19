/**
 * Deploys AVAL: three ERC-8004 registries, the credit contract, and the demo
 * counterparty. Writes deployments/<chainId>.json, which the SDK, the agent and
 * the web app all read, so no address is ever hardcoded in two places.
 *
 *   npx hardhat run scripts/deploy.ts --network botTestnet
 *   npx hardhat run scripts/deploy.ts --network botMainnet
 */
import { network } from "hardhat";
import { formatEther } from "viem";
import { mkdirSync, writeFileSync } from "node:fs";

const EXPLORERS: Record<number, string> = {
  677: "https://scan.botchain.ai",
  968: "https://scan.bohr.life",
  31337: "",
};

const { viem } = await network.connect();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

if (!deployer) {
  throw new Error("No signer. Set DEPLOYER_PRIVATE_KEY in .env (npx hardhat run scripts/keygen.ts).");
}

const chainId = await publicClient.getChainId();
const explorer = EXPLORERS[chainId] ?? "";
const deployerAddress = deployer.account!.address;
const balanceBefore = await publicClient.getBalance({ address: deployerAddress });

console.log(`network   ${chainId}`);
console.log(`deployer  ${deployerAddress}`);
console.log(`balance   ${formatEther(balanceBefore)} BOT\n`);

if (balanceBefore === 0n) {
  throw new Error(
    chainId === 968
      ? "Deployer has no tBOT. Claim from https://faucet.botchain.ai/basic (10 tBOT / 24h)."
      : "Deployer has no BOT. Fund it before deploying to mainnet.",
  );
}

async function deploy(name: string, args: unknown[] = []) {
  const c = await viem.deployContract(name as never, args as never);
  const address = c.address;
  console.log(`  ${name.padEnd(20)} ${address}`);
  return c;
}

console.log("deploying:");
// The identity registry is the root of trust: everything else points at it.
const identity = await deploy("IdentityRegistry");
const reputation = await deploy("ReputationRegistry", [identity.address]);
const validation = await deploy("ValidationRegistry", [identity.address]);
const letter = await deploy("LetterOfCredit", [
  identity.address,
  reputation.address,
  validation.address,
]);
// A stand-in approved supplier so `execute` has a real target to allowlist.
const vendor = await deploy("ServiceVendor", [deployerAddress]);

// Prove the wiring on-chain rather than assuming the constructor args landed.
const wiredIdentity = await reputation.read.getIdentityRegistry();
const wiredValidation = await validation.read.getIdentityRegistry();
const letterIdentity = await letter.read.identity();
const ok =
  wiredIdentity.toLowerCase() === identity.address.toLowerCase() &&
  wiredValidation.toLowerCase() === identity.address.toLowerCase() &&
  letterIdentity.toLowerCase() === identity.address.toLowerCase();
if (!ok) throw new Error("post-deploy wiring check failed");

const blockNumber = await publicClient.getBlockNumber();
const balanceAfter = await publicClient.getBalance({ address: deployerAddress });

const record = {
  chainId,
  explorer,
  deployedAtBlock: Number(blockNumber),
  deployedAt: new Date().toISOString(),
  deployer: deployerAddress,
  contracts: {
    IdentityRegistry: identity.address,
    ReputationRegistry: reputation.address,
    ValidationRegistry: validation.address,
    LetterOfCredit: letter.address,
    ServiceVendor: vendor.address,
  },
};

mkdirSync("deployments", { recursive: true });
writeFileSync(`deployments/${chainId}.json`, `${JSON.stringify(record, null, 2)}\n`);

console.log(`\nwiring    ok (all three registries agree on the identity registry)`);
console.log(`gas spent ${formatEther(balanceBefore - balanceAfter)} BOT`);
console.log(`written   deployments/${chainId}.json`);

if (explorer) {
  console.log("\nverify next:");
  console.log(`  npx hardhat run scripts/verify.ts --network ${chainId === 677 ? "botMainnet" : "botTestnet"}`);
  console.log("\nexplorer:");
  for (const [name, address] of Object.entries(record.contracts)) {
    console.log(`  ${name.padEnd(20)} ${explorer}/address/${address}`);
  }
}
