# AVAL

**A letter of credit for AI agents on BOT Chain.** Money is locked to a job, a
rulebook and an examiner. The agent that does the job spends only inside the
rulebook and never holds the money itself; its fee moves only after the
evidence is independently examined. A payment outside the rules is refused by
the chain, and the refusal is recorded in a block forever.

*Per aval* is a guarantee written onto a bill of exchange: someone stands
behind the payment. That is what this contract does for software with a wallet.

Live demo: <https://aval-botchain.vercel.app> · Docs: the same site, under
/docs (How it works, Using the dapp, BOT Chain research).

## Try it in one minute

1. Open the register and pick a credit stamped **OPEN**.
2. Expand *Attempt a payment the mandate forbids*, paste any address, run it.
   The chain refuses it and hands back the mined transaction as proof.
3. Run the permitted call instead, present the evidence, examine it, draw.
   Every role in a documentary credit, played from one page.

The demo buttons sign with capped testnet keys held server-side, so this needs
no wallet and no funds. With a wallet connected, an agent can be registered
against the visitor's own key and every role held personally.

## Where it runs

Deployed and source-verified on both BOT Chain networks.

| | Mainnet (677) | Testnet (968) |
| --- | --- | --- |
| LetterOfCredit | [`0xb0457f33…03e2`](https://scan.botchain.ai/address/0xb0457f336778ee33b426069b8383af3efb8503e2) | [`0x1145970c…8e99`](https://scan.bohr.life/address/0x1145970c4eb218a7d1a05245503a0fc05e7b8e99) |
| IdentityRegistry | [`0x1145970c…8e99`](https://scan.botchain.ai/address/0x1145970c4eb218a7d1a05245503a0fc05e7b8e99) | [`0xe06a0801…5ffd`](https://scan.bohr.life/address/0xe06a0801706679e73dd04917a63aa796788f5ffd) |
| ReputationRegistry | [`0xdd4ffa32…4d61`](https://scan.botchain.ai/address/0xdd4ffa32cd6e8b2d0afeb1ab277683ad16bb4d61) | [`0x8a518ab8…1fbe`](https://scan.bohr.life/address/0x8a518ab8c75c562170d71a88151cf1611b811fbe) |
| ValidationRegistry | [`0x5aade5e3…e17e`](https://scan.botchain.ai/address/0x5aade5e3915168e6b7d3678cd0b054a3fbc2e17e) | [`0x84b1bb99…c511`](https://scan.bohr.life/address/0x84b1bb992c5bb33e4cd05b32cc969683d1f3c511) |
| ServiceVendor (demo) | [`0x01d7aa2a…78ee`](https://scan.botchain.ai/address/0x01d7aa2a9b9b15c98ce8cf00fac6b1f825f578ee) | [`0xdd4ffa32…4d61`](https://scan.bohr.life/address/0xdd4ffa32cd6e8b2d0afeb1ab277683ad16bb4d61) |

The interactive playground is testnet, where the demo keys work and nothing is
real money. Mainnet carries the same frozen contracts and has run a full
lifecycle: a credit issued, two forbidden payments mined as reverts, the
supplier paid, the evidence examined 100/100, the credit settled, and an open
credit live for inspection.

## Three properties, each one a test in the suite

1. **The agent never holds the money.** The credit contract does. The agent
   proposes; the mandate decides: named recipients, a named contract and exact
   method, a per-call cap, a total cap, an expiry.
2. **Payment is against documents.** The fee is reserved out of the face value
   and becomes drawable only once the examiner named at issuance has scored
   the exact evidence hash at or above the credit's threshold, read from the
   ERC-8004 Validation Registry.
3. **The credit is itself a claim.** It is an ERC-721: whoever holds it
   collects at settlement, so the claim is assignable, exactly as documentary
   credits have worked for centuries.

## The ERC-8004 gap

Agent identity, examination and reputation run on ERC-8004 (Trustless Agents),
the standard BOT Chain has committed to. The canonical registry addresses on
BOT Chain mainnet hold placeholder proxies: `name()` reverts, no agent can
register, and the upgrade key belongs to the ERC-8004 deployer. AVAL therefore
ships working, spec-conformant registries on the same chain, ported from the
reference implementation with the external ABI unchanged, and the dapp checks
both live on every load of its ERC-8004 page. Because the credit contract uses
nothing outside the standard interface, it can be repointed at the canonical
addresses without a code change. Full on-chain evidence:
[docs/RESEARCH.md](docs/RESEARCH.md).

## Development

```bash
npm install
npx hardhat compile
npx hardhat test                       # 31 tests, no network needed

npx hardhat run scripts/keygen.ts      # writes 4 dev keys to .env
# fund them at https://faucet.botchain.ai/basic  (10 tBOT / 24h / address)

npx hardhat run scripts/chain-check.ts --network botTestnet
npx hardhat run scripts/deploy.ts      --network botTestnet
npx hardhat run scripts/verify.ts      --network botTestnet
npx hardhat run scripts/setup-agent.ts --network botTestnet
npx hardhat run scripts/demo.ts        --network botTestnet
npx hardhat run scripts/seed-open-letter.ts --network botTestnet
```

Swap `botTestnet` for `botMainnet` to run against mainnet. Demo and seed
amounts are env-tunable (`DEMO_FACE`, `DEMO_FEE`, `DEMO_PER_CALL`,
`SEED_FACE`, `SEED_FEE`, `SEED_PER_CALL`). For a fundless rehearsal, run
`npx hardhat node` and use `--network localhost`.

The web app:

```bash
npx hardhat run scripts/export-abis.ts   # ABIs, addresses and docs, generated
cd web && npm install && npm run dev
```

Deploys to Vercel as-is: import the repo, set the Root Directory to `web`.
There is no database and no required environment variable; setting the four
role keys enables the walletless demo buttons (testnet only, refused on
mainnet in code).

## Repository layout

```
contracts/
  LetterOfCredit.sol        the instrument: mandate, presentation, draw, dispute
  erc8004/                  Identity, Reputation, Validation registries
  interfaces/IERC8004.sol   only what the credit calls, so it stays repointable
  demo/ServiceVendor.sol    an approved supplier, a real target to allowlist
agent/                      the agent runtime and the reference examiner
scripts/                    deploy, verify, agent setup, lifecycle demo, seeding
web/                        the dapp (Next.js); web/lib/indexer.ts recovers
                            reverted transactions and decodes their reasons
test/letter.ts              31 tests, every mandate-violation path included
docs/                       rendered at /docs on the site
```

## Design notes

- **Refusals are mined, not logged.** Expected rejections are broadcast with
  gas supplied manually, so they land in blocks as decodable reverts instead of
  dying in wallet-side estimation. The evidence is the transaction.
- **The examiner is a trusted named party**, chosen at issuance, as the issuing
  bank is in a traditional letter of credit. The chain enforces who scored
  what; it does not prove the examiner honest.
- **The mandate constrains contracts and methods, not call arguments.** Right
  for a payment method like `invoice(bytes32)`, not yet sufficient for a DEX
  router. Argument-level constraints are the next version; plain payments to
  named recipients carry no such caveat.
- **Documents live on-chain in full**, hash-bound by the contract, so the
  evidence survives with no pinning service and no server of record.

## Licence

MIT.
