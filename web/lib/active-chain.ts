import { cookies } from "next/headers";
import { DEFAULT_CHAIN_ID, hasDeployment, type ChainId } from "./chain";

export const CHAIN_COOKIE = "aval-chain";

// The visitor's chosen network, kept in a cookie so every page renders it server-side.
export async function activeChainId(): Promise<ChainId> {
  const raw = (await cookies()).get(CHAIN_COOKIE)?.value;
  const id = Number(raw);
  return Number.isInteger(id) && hasDeployment(id) ? (id as ChainId) : DEFAULT_CHAIN_ID;
}
