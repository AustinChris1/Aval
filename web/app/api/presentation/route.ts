import { NextResponse } from "next/server";
import { parseAbiItem, type Hex } from "viem";
import { DEFAULT_CHAIN_ID, abis, contracts, hasDeployment, publicClient, type ChainId } from "@/lib/chain";
import { getLetter } from "@/lib/indexer";

// Hands over the raw document bytes, the stored hash and the examiner's answer; the browser does the hashing and comparison itself.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const letterId = params.get("letterId");
  if (!letterId) return NextResponse.json({ error: "letterId required" }, { status: 400 });

  const requested = Number(params.get("chain"));
  const chainId: ChainId = hasDeployment(requested) ? (requested as ChainId) : DEFAULT_CHAIN_ID;
  const client = publicClient(chainId);
  const c = contracts(chainId);

  try {
    const { letter } = await getLetter(chainId, BigInt(letterId));

    const logs = await client.getLogs({
      address: c.LetterOfCredit,
      event: parseAbiItem(
        "event DocumentsPresented(uint256 indexed letterId, uint256 indexed agentId, bytes32 indexed docHash, string docURI, bytes documents)",
      ),
      args: { letterId: BigInt(letterId) } as never,
      fromBlock: 0n,
      toBlock: "latest",
    });

    const last = logs[logs.length - 1];
    const documents = (last?.args as { documents?: Hex } | undefined)?.documents ?? null;

    let validation: {
      validator: string;
      agentId: string;
      response: number;
      exists: boolean;
    } = { validator: "", agentId: "", response: 0, exists: false };

    if (letter.docHash && letter.docHash !== `0x${"0".repeat(64)}`) {
      try {
        const res = (await client.readContract({
          address: c.ValidationRegistry,
          abi: abis.ValidationRegistry,
          functionName: "getValidationStatus",
          args: [letter.docHash],
        })) as [string, bigint, number, Hex, string, bigint];
        validation = {
          validator: res[0],
          agentId: String(res[1]),
          response: Number(res[2]),
          exists: true,
        };
      } catch {
        // No validation request was ever opened over this hash.
      }
    }

    return NextResponse.json({
      documents,
      storedDocHash: letter.docHash,
      expectedValidator: letter.validator,
      expectedAgentId: String(letter.agentId),
      minScore: letter.minScore,
      validation,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
