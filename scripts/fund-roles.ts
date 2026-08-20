// Splits the deployer's balance across the other role keys; written for the 1 BOT mainnet gas grant. Run with --network botMainnet.
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";

const PLAN = [
  // The applicant carries the credits' face value, so it gets the largest cut.
  { role: "applicant", index: 1, amount: parseEther("0.32") },
  // The agent only ever pays gas, including the manually-gassed refusals.
  { role: "agent", index: 2, amount: parseEther("0.12") },
  // The examiner answers examinations and rules on disputes.
  { role: "examiner", index: 3, amount: parseEther("0.08") },
];

const { viem } = await network.connect();
const publicClient = await viem.getPublicClient();
const wallets = await viem.getWalletClients();
const deployer = wallets[0];
if (!deployer || wallets.length < 4) throw new Error("need all four role keys in .env");

const before = await publicClient.getBalance({ address: deployer.account!.address });
console.log(`deployer ${deployer.account!.address}: ${formatEther(before)} BOT`);

for (const p of PLAN) {
  const to = wallets[p.index]!.account!.address;
  const current = await publicClient.getBalance({ address: to });
  if (current >= p.amount) {
    console.log(`  ${p.role.padEnd(10)} already funded (${formatEther(current)})`);
    continue;
  }
  const hash = await deployer.sendTransaction({ to, value: p.amount - current });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ${p.role.padEnd(10)} ${to}  +${formatEther(p.amount - current)}  ${hash}`);
}

const after = await publicClient.getBalance({ address: deployer.account!.address });
console.log(`deployer keeps ${formatEther(after)} BOT for the deployment itself`);
