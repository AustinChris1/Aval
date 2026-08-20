// Shared script plumbing: role resolution, deployment lookup, document hashing, mined-revert helpers.
import { network } from "hardhat";
import { keccak256, stringToHex, formatEther, type Address, type Hex } from "viem";
import { readFileSync, existsSync } from "node:fs";

export const EXPLORERS: Record<number, string> = {
  677: "https://scan.botchain.ai",
  968: "https://scan.bohr.life",
  31337: "", // local rehearsal: no explorer
};

export type Deployment = {
  chainId: number;
  explorer: string;
  deployedAtBlock: number;
  deployer: Address;
  contracts: {
    IdentityRegistry: Address;
    ReputationRegistry: Address;
    ValidationRegistry: Address;
    LetterOfCredit: Address;
    ServiceVendor: Address;
  };
};

export async function connect() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  const wallets = await viem.getWalletClients();
  const [deployer, applicant, agent, validator] = wallets;
  if (!deployer || !applicant || !agent || !validator) {
    throw new Error(
      `Need four signers (deployer, applicant, agent, validator); .env supplied ${wallets.length}. ` +
        "Run: npx hardhat run scripts/keygen.ts",
    );
  }

  const path = `deployments/${chainId}.json`;
  if (!existsSync(path)) {
    throw new Error(`No deployment for chain ${chainId}. Run scripts/deploy.ts first.`);
  }
  const deployment = JSON.parse(readFileSync(path, "utf8")) as Deployment;
  const explorer = EXPLORERS[chainId] ?? deployment.explorer ?? "";

  const at = async (name: string, address: Address, wallet?: (typeof wallets)[number]) =>
    viem.getContractAt(name as never, address, wallet ? { client: { wallet } } : undefined);

  return {
    viem,
    publicClient,
    chainId,
    explorer,
    deployment,
    roles: { deployer, applicant, agent, validator },
    address: {
      deployer: deployer.account!.address as Address,
      applicant: applicant.account!.address as Address,
      agent: agent.account!.address as Address,
      validator: validator.account!.address as Address,
    },
    at,
    /** Contract bound to a given role's wallet. */
    contracts: {
      identity: (w?: (typeof wallets)[number]) => at("IdentityRegistry", deployment.contracts.IdentityRegistry, w),
      reputation: (w?: (typeof wallets)[number]) =>
        at("ReputationRegistry", deployment.contracts.ReputationRegistry, w),
      validation: (w?: (typeof wallets)[number]) =>
        at("ValidationRegistry", deployment.contracts.ValidationRegistry, w),
      letter: (w?: (typeof wallets)[number]) => at("LetterOfCredit", deployment.contracts.LetterOfCredit, w),
      vendor: (w?: (typeof wallets)[number]) => at("ServiceVendor", deployment.contracts.ServiceVendor, w),
    },
  };
}

export type Ctx = Awaited<ReturnType<typeof connect>>;

/** Canonical document encoding: the bytes that go on-chain and the hash examined. */
export function encodeDocuments(doc: unknown): { bytes: Hex; hash: Hex; json: string } {
  const json = JSON.stringify(doc);
  const bytes = stringToHex(json);
  return { bytes, hash: keccak256(bytes), json };
}

export const txLink = (explorer: string, hash: Hex) => (explorer ? `${explorer}/tx/${hash}` : hash);
export const addrLink = (explorer: string, address: Address) =>
  explorer ? `${explorer}/address/${address}` : address;

export type Rejection = {
  /** Present only when a block producer accepted and mined the failed attempt. */
  hash?: Hex;
  mined: boolean;
  /** The decoded custom error, e.g. RecipientNotAllowed(0x…). */
  error: string;
};

// Manual gas skips estimation so the expected refusal is mined as a reverted transaction; Hardhat's local node rejects it at send instead, reported honestly as mined: false.
export async function sendExpectedRejection(
  ctx: Ctx,
  wallet: Ctx["roles"]["agent"],
  args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: unknown[];
    gas?: bigint;
  },
): Promise<Rejection> {
  const decode = (e: unknown) => {
    const err = e as { shortMessage?: string; message?: string; metaMessages?: string[] };
    const fromMeta = (err.metaMessages ?? []).find((m) => /^Error: \w+\(/.test(m.trim()));
    if (fromMeta) return fromMeta.trim().replace(/^Error:\s*/, "");
    return (err.shortMessage ?? err.message ?? "unknown").split("\n")[0]!;
  };

  // Establish why it will fail, without broadcasting.
  let error = "call unexpectedly simulated clean";
  try {
    await ctx.publicClient.simulateContract({
      address: args.address,
      abi: args.abi as never,
      functionName: args.functionName as never,
      args: args.args as never,
      account: wallet.account!,
    });
  } catch (e) {
    error = decode(e);
  }

  try {
    const hash = await wallet.writeContract({
      address: args.address,
      abi: args.abi as never,
      functionName: args.functionName as never,
      args: args.args as never,
      gas: args.gas ?? 500_000n,
      account: wallet.account!,
      chain: null,
    } as never);

    const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
    return { hash, mined: receipt.status === "reverted", error };
  } catch (e) {
    // Dev nodes that refuse to mine failing transactions land here.
    return { mined: false, error: error === "call unexpectedly simulated clean" ? decode(e) : error };
  }
}

export function banner(title: string) {
  console.log(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);
}

export const bot = (v: bigint) => `${formatEther(v)} BOT`;
