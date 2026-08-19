import { NextResponse } from "next/server";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abis, contracts, publicClient, viemChain, CHAINS } from "@/lib/chain";
import { ACTIONS, actionById, finaliseArgs, parseArgs, valueOf } from "@/lib/actions";
import { DEMO_CHAIN_ID, KEY_FOR_ROLE, MAX_VALUE_WEI, demoAvailable } from "@/lib/demo";

/**
 * Demo signing.
 *
 * The point of this route is that a visitor with no wallet and no tBOT can still
 * drive the whole instrument, issue, spend, be refused, present, examine,
 * settle, and watch it land on a public chain. It signs with the four throwaway
 * demo role keys.
 *
 * It is therefore deliberately fenced in:
 *
 *   - Testnet 968 only. Mainnet is refused outright, in code, not by convention.
 *   - Only the actions in the shared catalogue, resolved by id. No arbitrary
 *     contract, function or calldata can be passed in.
 *   - Amounts are capped, so the demo float cannot be drained by repetition.
 *   - If the keys are not configured the route reports that plainly and the UI
 *     falls back to asking the visitor to connect their own wallet.
 *
 * These keys are throwaway testnet keys holding faucet funds. Never point this at
 * a network where the money is real.
 */


export async function GET() {
  return NextResponse.json({
    available: demoAvailable(),
    chainId: DEMO_CHAIN_ID,
    actions: ACTIONS.map((a) => a.id),
  });
}

export async function POST(request: Request) {
  let body: { action?: string; values?: Record<string, string>; chainId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  const chainId = body.chainId ?? DEMO_CHAIN_ID;
  if (chainId !== DEMO_CHAIN_ID) {
    return NextResponse.json(
      { error: "Demo signing is available on BOT Chain testnet only. Connect a wallet for mainnet." },
      { status: 403 },
    );
  }

  const action = body.action ? actionById(body.action) : undefined;
  if (!action) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const key = KEY_FOR_ROLE[action.role];
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Demo keys are not configured on this deployment. Connect a wallet to send this transaction yourself.",
      },
      { status: 503 },
    );
  }

  let args: unknown[];
  let value: bigint;
  try {
    args = finaliseArgs(action, parseArgs(action, body.values ?? {}));
    value = valueOf(action, body.values ?? {});
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (value > MAX_VALUE_WEI) {
    return NextResponse.json({ error: "Demo calls are capped at 1 tBOT." }, { status: 400 });
  }

  const chain = viemChain(DEMO_CHAIN_ID);
  const account = privateKeyToAccount(key as Hex);
  const wallet = createWalletClient({ account, chain, transport: http(CHAINS[DEMO_CHAIN_ID].rpc) });
  const client = publicClient(DEMO_CHAIN_ID);
  const address = contracts(DEMO_CHAIN_ID)[action.contract];
  const abi = abis[action.contract];

  try {
    // A refusal must be mined to be evidence, so estimation is skipped and gas is
    // supplied by hand. Everything else is estimated normally and should succeed.
    const hash = await wallet.writeContract({
      address,
      abi,
      functionName: action.fn,
      args,
      value,
      ...(action.expectRevert ? { gas: 500_000n } : {}),
    } as never);

    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });

    return NextResponse.json({
      hash,
      status: receipt.status,
      blockNumber: String(receipt.blockNumber),
      from: account.address,
      // A reverted receipt is the expected outcome for a refusal, and a failure
      // for anything else. The UI reads this rather than guessing.
      refusalRecorded: Boolean(action.expectRevert) && receipt.status === "reverted",
    });
  } catch (e) {
    const err = e as { shortMessage?: string; message?: string; metaMessages?: string[] };
    const decoded = (err.metaMessages ?? []).find((m) => /^Error: \w+\(/.test(m.trim()));
    return NextResponse.json(
      {
        error: decoded?.trim().replace(/^Error:\s*/, "") ?? err.shortMessage ?? err.message ?? "failed",
        from: account.address,
      },
      { status: 422 },
    );
  }
}
