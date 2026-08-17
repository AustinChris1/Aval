import {
  decodeErrorResult,
  decodeFunctionData,
  formatEther,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { abis, chainInfo, contracts, publicClient, type ChainId } from "./chain";

export type TimelineRow = {
  kind:
    | "issued"
    | "paid"
    | "executed"
    | "refused"
    | "presented"
    | "examined"
    | "drawn"
    | "disputed"
    | "resolved"
    | "refunded";
  title: string;
  detail: string;
  hash: Hex;
  blockNumber: bigint;
  timestamp?: bigint;
  /** A refusal: the mandate rejected this and the chain recorded it. */
  refused?: boolean;
  error?: string;
};

const LETTER_EVENTS = {
  issued: parseAbiItem(
    "event LetterIssued(uint256 indexed letterId, address indexed applicant, uint256 indexed agentId, address agentWalletAtIssuance, address asset, uint256 faceValue, uint256 fee, uint256 maxPerCall, uint64 expiry, address validator, uint8 minScore, bytes32 termsHash, string termsURI)",
  ),
  paid: parseAbiItem(
    "event Paid(uint256 indexed letterId, address indexed recipient, uint256 amount, uint256 spentTotal)",
  ),
  executed: parseAbiItem(
    "event Executed(uint256 indexed letterId, address indexed target, bytes4 indexed selector, uint256 value, uint256 spentTotal)",
  ),
  presented: parseAbiItem(
    "event DocumentsPresented(uint256 indexed letterId, uint256 indexed agentId, bytes32 indexed docHash, string docURI, bytes documents)",
  ),
  drawn: parseAbiItem(
    "event Drawn(uint256 indexed letterId, address indexed payee, uint256 fee, uint256 returned, uint8 score)",
  ),
  disputed: parseAbiItem(
    "event Disputed(uint256 indexed letterId, address indexed applicant, string reasonURI)",
  ),
  resolved: parseAbiItem(
    "event DisputeResolved(uint256 indexed letterId, bool favourBeneficiary, string resolutionURI)",
  ),
  refunded: parseAbiItem(
    "event Refunded(uint256 indexed letterId, address indexed applicant, uint256 amount, uint8 status)",
  ),
} as const;

const FROM_BLOCK = 0n;

/** Full letter state, straight from the contract. */
export async function getLetter(chainId: ChainId, letterId: bigint) {
  const client = publicClient(chainId);
  const address = contracts(chainId).LetterOfCredit;

  const [letter, mandate, available, holder, docURI] = await Promise.all([
    client.readContract({ address, abi: abis.LetterOfCredit, functionName: "getLetter", args: [letterId] }),
    client.readContract({ address, abi: abis.LetterOfCredit, functionName: "mandate", args: [letterId] }),
    client.readContract({ address, abi: abis.LetterOfCredit, functionName: "available", args: [letterId] }),
    client
      .readContract({ address, abi: abis.LetterOfCredit, functionName: "ownerOf", args: [letterId] })
      .catch(() => null),
    client.readContract({ address, abi: abis.LetterOfCredit, functionName: "docURI", args: [letterId] }),
  ]);

  const [recipients, targets, selectors, perCallCap] = mandate as [Address[], Address[], Hex[], bigint];
  return {
    letter: letter as Record<string, never> & {
      applicant: Address;
      asset: Address;
      validator: Address;
      agentId: bigint;
      faceValue: bigint;
      fee: bigint;
      spent: bigint;
      expiry: bigint;
      disputeWindow: bigint;
      presentedAt: bigint;
      minScore: number;
      status: number;
      termsHash: Hex;
      docHash: Hex;
    },
    mandate: { recipients, targets, selectors, perCallCap },
    available: available as bigint,
    holder: holder as Address | null,
    docURI: docURI as string,
  };
}

export async function totalLetters(chainId: ChainId): Promise<bigint> {
  const client = publicClient(chainId);
  return (await client.readContract({
    address: contracts(chainId).LetterOfCredit,
    abi: abis.LetterOfCredit,
    functionName: "totalLetters",
  })) as bigint;
}

/**
 * Recovers a reverted transaction's decoded custom error.
 *
 * A reverted call emits no logs, so no amount of eth_getLogs will find it. The
 * transaction itself is still in the chain, so we replay it with eth_call against
 * its parent block and decode the revert data against our own ABI. Nothing here
 * trusts the explorer's rendering of the failure.
 */
export async function decodeRevert(chainId: ChainId, hash: Hex): Promise<string | undefined> {
  const client = publicClient(chainId);
  try {
    const tx = await client.getTransaction({ hash });
    try {
      await client.request({
        method: "eth_call",
        params: [
          {
            to: tx.to ?? undefined,
            from: tx.from,
            data: tx.input,
            value: `0x${tx.value.toString(16)}`,
          } as never,
          `0x${(tx.blockNumber! - 1n).toString(16)}` as never,
        ],
      });
      return undefined; // replayed clean; nothing to decode
    } catch (e) {
      const data = extractRevertData(e);
      if (!data || data === "0x") return "reverted without a reason";
      try {
        const decoded = decodeErrorResult({ abi: abis.LetterOfCredit, data: data as Hex });
        const args = (decoded.args ?? []).map((a) => String(a)).join(", ");
        return args ? `${decoded.errorName}(${args})` : decoded.errorName;
      } catch {
        return `reverted (${data.slice(0, 10)})`;
      }
    }
  } catch {
    return undefined;
  }
}

function extractRevertData(e: unknown): string | undefined {
  const seen = new Set<unknown>();
  const walk = (node: unknown): string | undefined => {
    if (!node || typeof node !== "object" || seen.has(node)) return undefined;
    seen.add(node);
    const o = node as Record<string, unknown>;
    if (typeof o.data === "string" && o.data.startsWith("0x")) return o.data;
    for (const key of ["cause", "error", "details", "walk"]) {
      const found = walk(o[key]);
      if (found) return found;
    }
    return undefined;
  };
  return walk(e);
}

/**
 * Finds transactions sent to the letter contract that reverted for this letter.
 *
 * This is the one place the explorer is consulted, because there is no standard
 * JSON-RPC way to list an address's transactions. Everything it returns is then
 * re-verified against the chain: the receipt must really be a failure, and the
 * calldata must really name this letter. If the explorer is unavailable the
 * timeline degrades to events only rather than breaking.
 */
export async function findRefusals(
  chainId: ChainId,
  letterId: bigint,
): Promise<{ rows: TimelineRow[]; explorerAvailable: boolean }> {
  const address = contracts(chainId).LetterOfCredit;
  const base = chainInfo(chainId).explorer;
  const client = publicClient(chainId);

  let candidates: { hash: Hex }[] = [];
  try {
    const res = await fetch(`${base}/api/v2/addresses/${address}/transactions?filter=to`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { items?: { hash: Hex; status?: string; result?: string }[] };
    candidates = (body.items ?? []).filter((t) => t.status === "error" || t.result === "Error");
  } catch {
    return { rows: [], explorerAvailable: false };
  }

  const rows: TimelineRow[] = [];
  for (const c of candidates.slice(0, 40)) {
    try {
      const [tx, receipt] = await Promise.all([
        client.getTransaction({ hash: c.hash }),
        client.getTransactionReceipt({ hash: c.hash }),
      ]);
      // The chain, not the explorer, decides whether this really failed.
      if (receipt.status !== "reverted") continue;

      const decoded = decodeFunctionData({ abi: abis.LetterOfCredit, data: tx.input });
      const args = decoded.args as readonly unknown[] | undefined;
      if (!args || args.length === 0 || (args[0] as bigint) !== letterId) continue;

      const error = await decodeRevert(chainId, c.hash);
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });

      rows.push({
        kind: "refused",
        title: titleForRefusal(decoded.functionName, error),
        detail: describeAttempt(decoded.functionName, args),
        hash: c.hash,
        blockNumber: receipt.blockNumber,
        timestamp: block.timestamp,
        refused: true,
        error,
      });
    } catch {
      // A candidate we cannot verify is a candidate we do not show.
    }
  }
  return { rows, explorerAvailable: true };
}

function titleForRefusal(fn: string, error?: string) {
  if (error?.startsWith("RecipientNotAllowed")) return "Refused — payee not named in the mandate";
  if (error?.startsWith("SelectorNotAllowed")) return "Refused — method not permitted";
  if (error?.startsWith("TargetNotAllowed")) return "Refused — contract not named in the mandate";
  if (error?.startsWith("ExceedsPerCallCap")) return "Refused — over the per-call cap";
  if (error?.startsWith("InsufficientCredit")) return "Refused — beyond the working capital";
  if (error?.startsWith("NotAgentWallet")) return "Refused — caller is not the agent's bound wallet";
  if (error?.startsWith("LetterExpired")) return "Refused — the letter had expired";
  return `Refused — ${fn}`;
}

function describeAttempt(fn: string, args: readonly unknown[]) {
  if (fn === "payTo") return `payTo(${String(args[1])}, ${formatEther(args[2] as bigint)})`;
  if (fn === "execute") return `execute(${String(args[1])}, ${formatEther(args[2] as bigint)})`;
  return fn;
}

/** The full history of one letter: successes from logs, refusals from receipts. */
export async function getTimeline(chainId: ChainId, letterId: bigint) {
  const client = publicClient(chainId);
  const address = contracts(chainId).LetterOfCredit;
  const rows: TimelineRow[] = [];

  const pull = async <K extends keyof typeof LETTER_EVENTS>(key: K) =>
    client.getLogs({
      address,
      event: LETTER_EVENTS[key] as never,
      args: { letterId } as never,
      fromBlock: FROM_BLOCK,
      toBlock: "latest",
    });

  const [issued, paid, executed, presented, drawn, disputed, resolved, refunded] = await Promise.all([
    pull("issued"),
    pull("paid"),
    pull("executed"),
    pull("presented"),
    pull("drawn"),
    pull("disputed"),
    pull("resolved"),
    pull("refunded"),
  ]);

  type LogLike = { transactionHash: Hex | null; blockNumber: bigint | null; args: unknown };
  const push = (kind: TimelineRow["kind"], title: string, detail: string, log: LogLike) =>
    rows.push({
      kind,
      title,
      detail,
      hash: log.transactionHash!,
      blockNumber: log.blockNumber!,
    });

  for (const l of issued as unknown as LogLike[]) {
    const a = l.args as { faceValue: bigint; fee: bigint; validator: Address; minScore: number };
    push(
      "issued",
      "Letter issued",
      `${formatEther(a.faceValue)} locked · ${formatEther(a.fee)} reserved as the fee · examiner ${a.validator.slice(0, 10)}… · threshold ${a.minScore}`,
      l,
    );
  }
  for (const l of paid as unknown as LogLike[]) {
    const a = l.args as { recipient: Address; amount: bigint };
    push("paid", "Paid a named recipient", `${formatEther(a.amount)} to ${a.recipient}`, l);
  }
  for (const l of executed as unknown as LogLike[]) {
    const a = l.args as { target: Address; selector: Hex; value: bigint };
    push(
      "executed",
      "Permitted call executed",
      `${formatEther(a.value)} to ${a.target} via ${a.selector}`,
      l,
    );
  }
  for (const l of presented as unknown as LogLike[]) {
    const a = l.args as { docHash: Hex; documents: Hex };
    push("presented", "Documents presented", `hash ${a.docHash.slice(0, 18)}…`, l);
  }
  for (const l of drawn as unknown as LogLike[]) {
    const a = l.args as { payee: Address; fee: bigint; returned: bigint; score: number };
    push(
      "drawn",
      "Credit drawn",
      `fee ${formatEther(a.fee)} to ${a.payee.slice(0, 10)}… · ${formatEther(a.returned)} returned · scored ${a.score}`,
      l,
    );
  }
  for (const l of disputed as unknown as LogLike[]) push("disputed", "Applicant disputed", "presentation contested", l);
  for (const l of resolved as unknown as LogLike[]) {
    const a = l.args as { favourBeneficiary: boolean };
    push("resolved", "Dispute resolved", a.favourBeneficiary ? "in favour of the agent" : "against the agent", l);
  }
  for (const l of refunded as unknown as LogLike[]) {
    const a = l.args as { amount: bigint };
    push("refunded", "Refunded to applicant", formatEther(a.amount), l);
  }

  const { rows: refusals, explorerAvailable } = await findRefusals(chainId, letterId);
  rows.push(...refusals);
  rows.sort((a, b) => Number(a.blockNumber - b.blockNumber));

  return { rows, explorerAvailable };
}

/**
 * Live check of the canonical ERC-8004 addresses versus this deployment.
 *
 * The canonical pair is always checked on **mainnet 677**, whichever chain this
 * app is pointed at, because that is where the reservation actually happened.
 * On testnet those addresses simply have no code, which understates the finding:
 * the interesting case is a deployed proxy whose registry logic is a placeholder.
 */
export async function getErc8004Status(chainId: ChainId) {
  const client = publicClient(chainId);
  const canonicalClient = publicClient(677);
  const CANONICAL = {
    IdentityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
    ReputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
  };

  const checkOn = async (c: ReturnType<typeof publicClient>, address: Address) => {
    const code = await c.getBytecode({ address });
    if (!code || code === "0x") return { address, deployed: false, working: false, note: "no code" };
    // A working identity registry is an ERC-721 and answers name().
    try {
      const name = await c.readContract({
        address,
        abi: [parseAbiItem("function name() view returns (string)")],
        functionName: "name",
      });
      return { address, deployed: true, working: true, note: `name() = "${name}"` };
    } catch {
      return { address, deployed: true, working: false, note: "name() reverts — placeholder proxy" };
    }
  };

  const ours = contracts(chainId);
  const [canonicalId, canonicalRep, ourId] = await Promise.all([
    checkOn(canonicalClient, CANONICAL.IdentityRegistry),
    checkOn(canonicalClient, CANONICAL.ReputationRegistry),
    checkOn(client, ours.IdentityRegistry),
  ]);

  const registered = await client
    .readContract({
      address: ours.IdentityRegistry,
      abi: abis.IdentityRegistry,
      functionName: "totalRegistered",
    })
    .catch(() => 0n);

  return { canonicalId, canonicalRep, ourId, registered: registered as bigint };
}

/** An agent's identity plus the reputation only settled letters could write. */
export async function getAgent(chainId: ChainId, agentId: bigint) {
  const client = publicClient(chainId);
  const c = contracts(chainId);

  const [owner, wallet, tokenURI] = await Promise.all([
    client.readContract({ address: c.IdentityRegistry, abi: abis.IdentityRegistry, functionName: "ownerOf", args: [agentId] }).catch(() => null),
    client.readContract({ address: c.IdentityRegistry, abi: abis.IdentityRegistry, functionName: "getAgentWallet", args: [agentId] }).catch(() => null),
    client.readContract({ address: c.IdentityRegistry, abi: abis.IdentityRegistry, functionName: "tokenURI", args: [agentId] }).catch(() => null),
  ]);

  const summary = (await client
    .readContract({
      address: c.ReputationRegistry,
      abi: abis.ReputationRegistry,
      functionName: "getSummary",
      args: [agentId, [c.LetterOfCredit], "letter.settled", ""],
    })
    .catch(() => [0n, 0n, 0])) as [bigint, bigint, number];

  let card: { name?: string; description?: string } | null = null;
  if (typeof tokenURI === "string" && tokenURI.startsWith("data:application/json;base64,")) {
    try {
      card = JSON.parse(Buffer.from(tokenURI.split(",")[1]!, "base64").toString("utf8"));
    } catch {
      card = null;
    }
  }

  return {
    owner: owner as Address | null,
    wallet: wallet as Address | null,
    card,
    settledCount: summary[0],
    averageScore: summary[1],
  };
}
