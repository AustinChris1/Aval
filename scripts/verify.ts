/**
 * Verifies every deployed contract on BOT Chain's Blockscout instance.
 *
 * Verified source is an explicit judging requirement and it is also the only way
 * a reader can check that the mandate logic on-chain is the mandate logic in this
 * repo. Blockscout needs no API key.
 *
 *   npx hardhat run scripts/verify.ts --network botTestnet
 */
import { network } from "hardhat";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const { viem } = await network.connect();
const publicClient = await viem.getPublicClient();
const chainId = await publicClient.getChainId();

const record = JSON.parse(readFileSync(`deployments/${chainId}.json`, "utf8"));
const networkName = chainId === 677 ? "botMainnet" : "botTestnet";

// Constructor arguments must match the deploy exactly or verification fails.
const constructorArgs: Record<string, string[]> = {
  IdentityRegistry: [],
  ReputationRegistry: [record.contracts.IdentityRegistry],
  ValidationRegistry: [record.contracts.IdentityRegistry],
  LetterOfCredit: [
    record.contracts.IdentityRegistry,
    record.contracts.ReputationRegistry,
    record.contracts.ValidationRegistry,
  ],
  ServiceVendor: [record.deployer],
};

let failures = 0;
for (const [name, address] of Object.entries(record.contracts) as [string, string][]) {
  console.log(`\nverifying ${name} at ${address}`);
  const args = [
    "hardhat",
    "verify",
    "--network",
    networkName,
    address,
    ...constructorArgs[name],
  ];
  const result = spawnSync("npx", args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    failures++;
    console.log(`  ${name} did not verify; retry individually:`);
    console.log(`  npx hardhat verify --network ${networkName} ${address} ${constructorArgs[name].join(" ")}`);
  }
}

console.log(
  failures === 0
    ? `\nAll ${Object.keys(record.contracts).length} contracts verified on ${record.explorer}`
    : `\n${failures} contract(s) still unverified`,
);
