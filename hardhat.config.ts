import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";

dotenv.config();

/**
 * Signer order is fixed and load-bearing: every script destructures
 * [deployer, applicant, agent, validator] from getWalletClients(). Missing keys
 * are dropped rather than substituted, so a half-configured .env fails loudly
 * instead of signing as the wrong role.
 */
const signers = () =>
  [
    process.env.DEPLOYER_PRIVATE_KEY,
    process.env.APPLICANT_PRIVATE_KEY,
    process.env.AGENT_PRIVATE_KEY,
    process.env.VALIDATOR_PRIVATE_KEY,
  ].filter((k): k is string => typeof k === "string" && k.length > 0);

/**
 * BOT Chain is a BNB-Chain-derived EVM L1 (Parlia consensus, ~0.67s blocks).
 * Verified live values (see docs/RESEARCH.md):
 *   mainnet chainId 677  rpc https://rpc.botchain.ai   explorer https://scan.botchain.ai   (Blockscout)
 *   testnet chainId 968  rpc https://rpc.bohr.life     explorer https://scan.bohr.life    (Blockscout)
 *
 * evmVersion is "cancun". OpenZeppelin 5.4 emits MCOPY and will not compile for
 * shanghai, and BOT Chain is Cancun-capable: eth_getBlobSidecars/
 * eth_getBlobSidecarByTxHash answer on both networks, so EIP-4844 is active.
 * Confirmed empirically by deploying and exercising the suite on testnet 968
 * before mainnet — see docs/RESEARCH.md.
 */
const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
          // LetterIssued carries the whole mandate in one event; that overflows
          // the legacy codegen's stack. viaIR also lets the audit trail stay one
          // event instead of several partial ones.
          viaIR: true,
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
          // LetterIssued carries the whole mandate in one event; that overflows
          // the legacy codegen's stack. viaIR also lets the audit trail stay one
          // event instead of several partial ones.
          viaIR: true,
        },
      },
    },
  },
  chainDescriptors: {
    677: {
      name: "BOT Chain Mainnet",
      blockExplorers: {
        blockscout: {
          url: "https://scan.botchain.ai",
          apiUrl: "https://scan.botchain.ai/api",
        },
      },
    },
    968: {
      name: "BOT Chain Testnet",
      blockExplorers: {
        blockscout: {
          url: "https://scan.bohr.life",
          apiUrl: "https://scan.bohr.life/api",
        },
      },
    },
  },
  verify: {
    blockscout: { enabled: true },
    etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || "" },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    /**
     * Persistent local chain for rehearsing the real deploy -> setup -> demo
     * sequence. Uses the standard Hardhat development keys so all four roles are
     * funded; `npx hardhat node` must be running.
     */
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      ],
    },
    botTestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.BOT_TESTNET_RPC_URL || "https://rpc.bohr.life",
      chainId: 968,
      accounts: signers(),
    },
    botMainnet: {
      type: "http",
      chainType: "l1",
      url: process.env.BOT_MAINNET_RPC_URL || "https://rpc.botchain.ai",
      chainId: 677,
      accounts: signers(),
    },
  },
};

export default config;
