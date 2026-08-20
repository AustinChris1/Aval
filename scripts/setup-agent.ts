// Registers the demo agent and binds its acting key; idempotent. The principal (deployer key) owns the ERC-721, the agent key acts and holds nothing.
import { connect, banner, addrLink, txLink } from "./lib/context.ts";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import type { Address } from "viem";

const ctx = await connect();
const { publicClient, address, explorer, chainId } = ctx;

banner("AVAL, agent registration (ERC-8004)");

const identityAsPrincipal = await ctx.contracts.identity(ctx.roles.deployer);
const identity = await ctx.contracts.identity();

const statePath = `deployments/${chainId}.agent.json`;
let agentId: bigint | undefined;

if (existsSync(statePath)) {
  const saved = JSON.parse(readFileSync(statePath, "utf8")) as { agentId: string };
  const candidate = BigInt(saved.agentId);
  try {
    const owner = (await identity.read.ownerOf([candidate])) as Address;
    if (owner.toLowerCase() === address.deployer.toLowerCase()) {
      agentId = candidate;
      console.log(`agent already registered: #${agentId} owned by ${owner}`);
    }
  } catch {
    // Not registered on this chain; fall through and register.
  }
}

if (agentId === undefined) {
  // The registration file is an embedded data URI (ERC-8004 registration-v1): self-describing on-chain, nothing to host.
  const card = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Treasury Operations Agent",
    description:
      "Settles approved supplier invoices under a documentary credit. Custodies nothing: " +
      "spends only from an AVAL mandate, and is paid only against an examined presentation.",
    services: [{ name: "web", endpoint: "https://aval-botchain.vercel.app/agent/0" }],
    x402Support: false,
    active: true,
    supportedTrust: ["reputation"],
  };
  const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(card)).toString("base64")}`;

  const tx = await identityAsPrincipal.write.register([agentURI]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  const total = (await identity.read.totalRegistered()) as bigint;
  agentId = total - 1n;
  console.log(`registered agent #${agentId} in block ${receipt.blockNumber}`);
  console.log(`  tx ${txLink(explorer, tx)}`);
}

// --- bind the acting key -------------------------------------------------

const currentWallet = (await identity.read.getAgentWallet([agentId])) as Address;
if (currentWallet.toLowerCase() === address.agent.toLowerCase()) {
  console.log(`acting key already bound: ${currentWallet}`);
} else {
  // The wallet signs for itself: a principal cannot bind a key it does not hold.
  const block = await publicClient.getBlock();
  const deadline = block.timestamp + 240n;

  const signature = await ctx.roles.agent.signTypedData({
    account: ctx.roles.agent.account!,
    domain: {
      name: "ERC8004IdentityRegistry",
      version: "1",
      chainId,
      verifyingContract: ctx.deployment.contracts.IdentityRegistry,
    },
    types: {
      AgentWalletSet: [
        { name: "agentId", type: "uint256" },
        { name: "newWallet", type: "address" },
        { name: "owner", type: "address" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "AgentWalletSet",
    message: {
      agentId,
      newWallet: address.agent,
      owner: address.deployer,
      deadline,
    },
  });

  const tx = await identityAsPrincipal.write.setAgentWallet([agentId, address.agent, deadline, signature]);
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`bound acting key ${address.agent}`);
  console.log(`  tx ${txLink(explorer, tx)}`);
}

writeFileSync(statePath, `${JSON.stringify({ chainId, agentId: agentId.toString() }, null, 2)}\n`);

console.log(`\nprincipal (owns agent)  ${address.deployer}`);
console.log(`agent wallet (acts)     ${address.agent}`);
console.log(`identity registry       ${addrLink(explorer, ctx.deployment.contracts.IdentityRegistry)}`);
console.log(`\nwrote ${statePath}`);
