import type { Role } from "./actions";

/**
 * The demo role keys, read on the server only.
 *
 * These are throwaway testnet keys holding faucet funds. They exist so a visitor
 * with no wallet and no tBOT can still drive an existing letter end to end. If a
 * deployment does not configure them, the UI falls back to asking for a wallet.
 */
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
