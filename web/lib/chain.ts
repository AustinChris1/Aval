import { createPublicClient, http, defineChain, type Address } from "viem";
import { deployments } from "./generated/deployments";
import { abis } from "./generated/abis";

export const CHAINS = {
  968: {
    id: 968,
    name: "BOT Chain Testnet",
    rpc: "https://rpc.bohr.life",
    explorer: "https://scan.bohr.life",
    symbol: "tBOT",
  },
  677: {
    id: 677,
    name: "BOT Chain Mainnet",
    rpc: "https://rpc.botchain.ai",
    explorer: "https://scan.botchain.ai",
    symbol: "BOT",
  },
} as const;

export type ChainId = keyof typeof CHAINS;

export const DEPLOYED_CHAIN_IDS = Object.keys(deployments)
  .map(Number)
  .filter((id): id is ChainId => id in CHAINS);

// Testnet 968 is the interactive default (demo signing is refused on mainnet in code); mainnet 677 is listed alongside, never the default.
export const DEFAULT_CHAIN_ID: ChainId = (
  DEPLOYED_CHAIN_IDS.includes(968 as ChainId) ? 968 : (DEPLOYED_CHAIN_IDS[0] ?? 968)
) as ChainId;

export function chainInfo(chainId: ChainId) {
  return CHAINS[chainId];
}

export function viemChain(chainId: ChainId) {
  const c = CHAINS[chainId];
  return defineChain({
    id: c.id,
    name: c.name,
    nativeCurrency: { name: "BOT", symbol: c.symbol, decimals: 18 },
    rpcUrls: { default: { http: [c.rpc] } },
    blockExplorers: { default: { name: "Blockscout", url: c.explorer } },
  });
}

// Reads go through the chain's own RPC; the explorer only discovers reverted candidates, each re-checked here before display.
export function publicClient(chainId: ChainId) {
  return createPublicClient({ chain: viemChain(chainId), transport: http(CHAINS[chainId].rpc) });
}

export function contracts(chainId: ChainId) {
  const d = (deployments as Record<string, { contracts: Record<string, Address> }>)[String(chainId)];
  if (!d) throw new Error(`No deployment for chain ${chainId}`);
  return d.contracts as {
    IdentityRegistry: Address;
    ReputationRegistry: Address;
    ValidationRegistry: Address;
    LetterOfCredit: Address;
    ServiceVendor: Address;
  };
}

export function hasDeployment(chainId: number): chainId is ChainId {
  return String(chainId) in deployments;
}

export { abis };

export const txUrl = (chainId: ChainId, hash: string) => `${CHAINS[chainId].explorer}/tx/${hash}`;
export const addressUrl = (chainId: ChainId, address: string) =>
  `${CHAINS[chainId].explorer}/address/${address}`;

export const STATUS = [
  "None",
  "Open",
  "Presented",
  "Disputed",
  "Settled",
  "Refunded",
  "Cancelled",
] as const;

export const short = (s: string, head = 6, tail = 4) =>
  s.length > head + tail + 2 ? `${s.slice(0, head + 2)}…${s.slice(-tail)}` : s;
