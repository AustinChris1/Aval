# BOT Chain: verified facts

Everything here was checked against the live chain or primary sources on
2026-08-17, not taken from documentation or secondary write-ups. Where the two
disagree, the on-chain result wins and the disagreement is noted, because several
widely-repeated claims about BOT Chain turned out to be wrong.

Reproduce any of it with `npx hardhat run scripts/chain-check.ts --network botTestnet`.

## Networks

|             | Mainnet                  | Testnet                 |
| ----------- | ------------------------ | ----------------------- |
| chainId     | 677 (`0x2a5`)            | 968 (`0x3c8`)           |
| RPC         | `https://rpc.botchain.ai`| `https://rpc.bohr.life` |
| Explorer    | `scan.botchain.ai`       | `scan.bohr.life`        |
| Native coin | BOT                      | tBOT (faucet)           |
| Faucet      | —                        | `faucet.botchain.ai/basic`, 10 tBOT / 24h / address |

Both answered `eth_chainId`, `eth_blockNumber` and `web3_clientVersion` live.

## It is a BNB-Chain derivative

`web3_clientVersion` returns `Geth/v1.5.13-…/linux-amd64/go1.26.5` on both
networks, and the developer docs cite Parlia consensus, BEP-126 and BEP-341.
BOT Chain is a BSC fork, which is the single most useful fact for building here:
the toolchain, gas semantics, opcode support and infrastructure conventions are
BSC's, and anything that works on BSC should be assumed available until proven
otherwise.

Measured block cadence: **~0.70s** (Blockscout reports a 669ms average). Gas
price: **20 gwei**, flat. At that price a full AVAL deployment cost under
0.008 BOT, so the challenge's 1 BOT gas grant is ample.

## Corrections to widely-repeated claims

Three things commonly asserted about BOT Chain are false, and each one would
have changed this project's architecture if taken on trust.

**1. `eth_getLogs` is not disabled on the public mainnet RPC.** The official docs
say it is. It answered a 6-block range and a 9,638-block range on
`rpc.botchain.ai` with real logs. The dashboard can therefore index by log query
and does not need a WebSocket-only path. Still worth re-checking per endpoint
rather than trusting either the docs or this note.

**2. The blob APIs are real.** `eth_getBlobSidecars` and
`eth_getBlobSidecarByTxHash` both answer on mainnet (`result: []` and
`result: null` respectively). A method that did not exist returns
`-32601 the method … does not exist/is not available`, which is what a control
call produced. EIP-4844 is therefore active, the reason this project compiles
for `evmVersion: "cancun"` at all, since OpenZeppelin 5.4 emits `MCOPY`.

**3. ERC-4337 is deployed.** EntryPoint v0.7 has code at the canonical
`0x0000000071727De22E5E9d8BAf0edAc6f37da032`. So do Multicall3
(`0xcA11bde…CA11`) and Permit2 (`0x000000000022D473…78BA3`). Account abstraction
is not "coming soon" at the contract layer; what is missing is a public bundler.

## The ERC-8004 situation on BOT Chain, the gap this project fills

The canonical ERC-8004 registries are **reserved but not functional** on BOT
Chain mainnet. This is the central finding.

| Address | Expected | Actually |
| --- | --- | --- |
| `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | IdentityRegistry | `ERC1967Proxy` → `MinimalUUPSMainnet` |
| `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | ReputationRegistry | `ERC1967Proxy` → `MinimalUUPSMainnet` |

Evidence:

- Both proxies' EIP-1967 implementation slot points at
  `0xcB7Af40C0be4Fb92E183942b6DbB6b14A888F067`, which Blockscout has verified
  under the name `MinimalUUPSMainnet`, the placeholder from the reference repo.
- `name()` **reverts** on the identity registry. There is no ERC-721 behind it,
  so no agent can be registered.
- `getVersion()` returns `1.0.0` (the placeholder) rather than `2.0.0` (the real
  implementation).
- `owner()` is `0x547289319C3e6aedB179C0b8e8aF0B5ACd062603`, the ERC-8004
  deployer, hardcoded in `MinimalUUPSMainnet.initialize`. **We cannot upgrade
  them**, so occupying the canonical addresses is not an option.
- On testnet 968 the addresses have no code at all.

The reference implementation reserved these vanity addresses across ~24 chains
via a singleton factory (EIP-2470's factory is present on 677 at
`0xce0042B8…cf9f`; absent on 968). BOT Chain got the address reservation and
never got the registries.

So: ERC-8004 is announced on BOT Chain and not usable on BOT Chain. AVAL
deploys spec-conformant registries, ported from the reference implementation
with the external ABI unchanged, and builds a real product on top of them.
Because only the ERC-8004 interface is used, the credit contract can be
repointed at the canonical addresses unchanged if they are ever filled in.

## Spec details that shaped the design

Read from the ERC-8004 draft and the reference implementation, and they are not
obvious:

- **Identity is an ERC-721**, and the `agentWallet` is bound separately by an
  EIP-712 signature *from the wallet itself*, a principal cannot claim a key it
  does not control. The binding is cleared on transfer, so selling an agent does
  not hand over its live signing key.
- **`agentId` starts at 0.** Never use `agentId != 0` as an existence check; use
  `ownerOf`, which reverts for a nonexistent id.
- **`giveFeedback` rejects self-feedback**: it reverts if the caller owns or is
  approved for the agent. This is why AVAL must *not* hold blanket ERC-721
  approval over the agents it settles for, if it did, its own feedback would be
  rejected as self-feedback. It also means feedback written by the credit
  contract is structurally more trustworthy than feedback from an arbitrary
  address, which is the same intent as the spec's `proofOfPayment` field.
- **`validationRequest` must come from the agent's owner or an approved
  operator**, not from an arbitrary contract. So the principal opens the
  examination; the credit only *reads* the result.
- **A pending validation reads as `response = 0`**, indistinguishable from a
  genuine zero score, and the spec exposes no "has answered" flag. AVAL
  therefore requires `minScore >= 1` at issuance, which makes an unexamined
  presentation impossible to draw against without relying on any non-standard
  helper.

## Assets on mainnet

Real tokens with real holder counts, from the Blockscout token index:

- WBOT `0xD5452816194a3784dBa983426cCe7c122F4abd30`, 57,736 holders
- USDT `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`, 289,191 holders

A credit can be denominated in either, which matters for the RWA framing: real
documentary credits are written in stablecoin-equivalents, not in a volatile gas
token. `LetterOfCredit` supports the native coin and any ERC-20.

BOT traded around $9.25 with a ~$1.39B reported market cap at the time of
writing.

## Tooling

- Explorer is **Blockscout** (Next.js frontend, `/api/v2` and an
  Etherscan-compatible `/api`). Verification works with no API key;
  `standard-input`, `flattened-code` and `multi-part` are all accepted, and the
  Rust verifier microservice is enabled.
- Compiler versions already verified on the explorer include 0.8.24, 0.8.28,
  0.8.34 and 0.8.35. This project uses **0.8.28**.
- The two addresses in the B DEX frontend bundle that look like a router and a
  factory (`0x82Cb7Cd6…7663`, `0x32685b8D…952b`) revert on `WETH()` and
  `factory()`. AVAL's demo deliberately depends on no external protocol.
