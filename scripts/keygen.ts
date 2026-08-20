// Generates the four throwaway demo keys into .env; never reuse them for anything holding real value.
import { writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const ROLES = [
  ["DEPLOYER_PRIVATE_KEY", "deploys the registries and the credit contract"],
  ["APPLICANT_PRIVATE_KEY", "the human/treasury that issues letters and locks funds"],
  ["AGENT_PRIVATE_KEY", "the agent's bound wallet: acts, never custodies"],
  ["VALIDATOR_PRIVATE_KEY", "the named examiner that scores documents"],
] as const;

const envPath = ".env";
if (!existsSync(envPath)) copyFileSync(".env.example", envPath);

let env = readFileSync(envPath, "utf8");
const generated: string[] = [];

for (const [key, purpose] of ROLES) {
  const line = new RegExp(`^${key}=(.*)$`, "m");
  const current = env.match(line)?.[1]?.trim();
  if (current && current.length > 0) {
    const account = privateKeyToAccount(current as `0x${string}`);
    console.log(`  kept     ${key.padEnd(24)} ${account.address}  (${purpose})`);
    continue;
  }
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  env = line.test(env) ? env.replace(line, `${key}=${pk}`) : `${env}\n${key}=${pk}`;
  generated.push(`${key}=${account.address}`);
  console.log(`  generated ${key.padEnd(24)} ${account.address}  (${purpose})`);
}

writeFileSync(envPath, env);

if (generated.length > 0) {
  console.log(`\nWrote ${generated.length} new key(s) to .env (gitignored).`);
  console.log("\nFund these on BOT Chain Testnet (968), 10 tBOT per address per 24h:");
  console.log("  https://faucet.botchain.ai/basic");
  console.log("\nThe deployer needs gas. The applicant needs gas plus the letters' face value.");
  console.log("The agent needs only gas: it never holds the credit.");
} else {
  console.log("\nAll four keys already present in .env; nothing generated.");
}
