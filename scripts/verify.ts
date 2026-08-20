// Verifies every deployed contract on BOT Chain's Blockscout (no API key). Run with --network botTestnet or botMainnet.
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

for (const [name, address] of Object.entries(record.contracts) as [string, string][]) {
  console.log(`\nverifying ${name} at ${address}`);
  const args = ["hardhat", "verify", "--network", networkName, address, ...constructorArgs[name]];
  spawnSync("npx", args, { stdio: "inherit", shell: true });
}

// hardhat verify exits non-zero when Sourcify (which lacks chains 677/968) declines, so ask the explorer what it actually holds.
console.log("\nconfirming with the explorer:");
let unverified = 0;
for (const [name, address] of Object.entries(record.contracts) as [string, string][]) {
  try {
    const res = await fetch(`${record.explorer}/api/v2/addresses/${address}`);
    const body = (await res.json()) as { is_verified?: boolean; name?: string };
    const ok = body.is_verified === true;
    if (!ok) unverified++;
    console.log(`  ${ok ? "verified " : "MISSING  "} ${name.padEnd(20)} ${body.name ?? "?"}`);
  } catch (e) {
    unverified++;
    console.log(`  UNKNOWN   ${name.padEnd(20)} explorer lookup failed: ${(e as Error).message}`);
  }
}

console.log(
  unverified === 0
    ? `\nAll ${Object.keys(record.contracts).length} contracts verified on ${record.explorer}`
    : `\n${unverified} contract(s) still unverified`,
);
process.exitCode = unverified === 0 ? 0 : 1;
