import type { Role } from "./actions";

// Throwaway testnet role keys, read server-side only; a deployment without them falls back to asking for a wallet.
export const KEY_FOR_ROLE: Record<Role, string | undefined> = {
  applicant: process.env.APPLICANT_PRIVATE_KEY,
  agent: process.env.AGENT_PRIVATE_KEY,
  validator: process.env.VALIDATOR_PRIVATE_KEY,
  principal: process.env.DEPLOYER_PRIVATE_KEY,
  anyone: process.env.DEPLOYER_PRIVATE_KEY,
};

export const DEMO_CHAIN_ID = 968;
export const MAX_VALUE_WEI = 1_000_000_000_000_000_000n;

export function demoAvailable() {
  return Object.values(KEY_FOR_ROLE).every((k) => typeof k === "string" && k.length > 0);
}
