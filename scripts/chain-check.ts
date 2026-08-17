/**
 * Pre-flight against a live BOT Chain endpoint.
 *
 * Confirms the things a deploy silently depends on: which chain answered, that
 * it is Cancun-capable (our bytecode uses MCOPY via OpenZeppelin 5.4), whether
 * eth_getLogs is usable for the dashboard, and what the deployer can pay for.
 *
 *   npx hardhat run scripts/chain-check.ts --network botTestnet
 */
import { network } from "hardhat";
import { formatEther } from "viem";

const EXPECTED = {
  677: { name: "BOT Chain Mainnet", explorer: "https://scan.botchain.ai" },
  968: { name: "BOT Chain Testnet", explorer: "https://scan.bohr.life" },
} as const;

const { viem, provider } = await network.connect();
const publicClient = await viem.getPublicClient();

const chainId = await publicClient.getChainId();
const known = EXPECTED[chainId as keyof typeof EXPECTED];
console.log(`chainId          ${chainId}  ${known ? known.name : "(unrecognised)"}`);

const [clientVersion, blockNumber, gasPrice] = await Promise.all([
  provider.request({ method: "web3_clientVersion", params: [] }) as Promise<string>,
  publicClient.getBlockNumber(),
  publicClient.getGasPrice(),
]);
console.log(`client           ${clientVersion}`);
console.log(`head             ${blockNumber}`);
console.log(`gasPrice         ${formatEther(gasPrice, "gwei")} gwei`);

// Two consecutive blocks give us the real cadence; BOT Chain runs sub-second.
const head = await publicClient.getBlock({ blockNumber });
const prev = await publicClient.getBlock({ blockNumber: blockNumber - 10n });
const cadence = Number(head.timestamp - prev.timestamp) / 10;
console.log(`block time       ~${cadence.toFixed(2)}s`);

// Cancun probe: a chain serving blob sidecar RPCs has EIP-4844 active, which is
// the same fork that introduced MCOPY. If this errors, drop evmVersion to
// shanghai and pin OpenZeppelin to a 5.0.x line.
try {
  await provider.request({ method: "eth_getBlobSidecars", params: ["latest"] });
  console.log("blob API         eth_getBlobSidecars answers -> Cancun active");
} catch (e) {
  console.log(`blob API         UNAVAILABLE (${(e as Error).message}) -> re-check evmVersion`);
}

// The docs say eth_getLogs is disabled on the public mainnet RPC. It is not, as
// of this writing — but verify per-endpoint rather than trusting either source.
try {
  const from = blockNumber > 200n ? blockNumber - 200n : 0n;
  const logs = await publicClient.getLogs({ fromBlock: from, toBlock: blockNumber });
  console.log(`eth_getLogs      ok over 200 blocks (${logs.length} logs)`);
} catch (e) {
  console.log(`eth_getLogs      unavailable (${(e as Error).message}) -> indexer must use WS`);
}

const wallets = await viem.getWalletClients();
if (wallets.length === 0) {
  console.log("\nNo signer configured. Set DEPLOYER_PRIVATE_KEY in .env (npx hardhat run scripts/keygen.ts).");
} else {
  console.log("");
  for (const w of wallets) {
    const address = w.account!.address;
    const balance = await publicClient.getBalance({ address });
    console.log(`signer           ${address}  ${formatEther(balance)} BOT`);
  }
  if (known) console.log(`\nexplorer         ${known.explorer}`);
}
