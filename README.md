# AVAL

**A letter of credit for AI agents.** Lock money against a job, an agent, a
rulebook and an examiner. The agent cannot spend outside the rulebook, and cannot
be paid without documents someone actually checked.

*Per aval* is a guarantee written directly onto a bill of exchange: a third party
endorsing that the instrument will be honoured. That is what this is, for software
with a wallet.

Built for the BOT Chain Builder Challenge #2 (AI × RWA).

---

## The problem

Agents now hold wallets. Every team shipping one gets the same question and none
of them have a good answer: *what happens when it goes wrong?*

The industry's answer so far is observability, log what the agent did, and
review it afterwards. That is a flight recorder: it tells you how you crashed. If
an agent with a funded key decides to send everything to an address it invented,
a log tells you about it after the money is gone.

Commerce solved this in the 14th century, and not with logging. A documentary
credit puts an intermediary between the payer and the beneficiary: funds are
committed up front, the beneficiary can only draw against documents that comply
with terms agreed in advance, and the payer's exposure is capped by construction.
Nobody has to trust the counterparty's good behaviour, because the counterparty
never has custody.

AVAL is that instrument, on-chain, with an ERC-8004 agent as the beneficiary.

## What it actually does

```
applicant                LetterOfCredit                    agent
   │                           │                             │
   ├─ issue() ────────────────>│  locks funds                │
   │  agentId, mandate,        │  mints the credit as ERC-721│
   │  examiner, expiry         │                             │
   │                           │<──── payTo / execute ───────┤  agent proposes
   │                           │      ✗ not in mandate → revert (mined)
   │                           │      ✓ in mandate → funds move
   │                           │<──── presentDocuments ──────┤
   │                           │                             │
   │                    examiner scores the document hash
   │                    in the ERC-8004 Validation Registry
   │                           │
   │                           ├─ draw() → fee to credit holder,
   │                           │           unspent capital back to applicant,
   │                           └───────── reputation written to ERC-8004
```

Three properties follow, and each one is a test in `test/credit.ts`:

**The agent never holds the money.** The credit contract does. The agent submits
intents and the contract executes them only if the mandate permits, allowlisted
recipients, allowlisted contract *and* method, a per-call cap, a total cap, an
expiry. A forbidden payment is not a loss to chase afterwards; it reverts.

**Payment is against documents.** The fee is reserved out of the face value and
is not spendable working capital. It becomes drawable only once the examiner
named at issuance has scored the exact document hash the agent presented, at or
above the threshold written into the credit. The credit reads that score from the
ERC-8004 Validation Registry.

The examiner is a named, trusted party, exactly as the issuing bank is in a real
documentary credit. The chain enforces that *this* examiner scored *this* hash
above *this* threshold; it does not prove the examiner was honest. The applicant
chose them at issuance, and that choice is the trust assumption. Anyone claiming
otherwise about an escrow like this is overselling it.

**The credit is itself a claim.** It is an ERC-721. Whoever holds it receives the
proceeds, so a credit can be assigned or sold, which is how documentary credits
work in the real world, and what makes this an RWA rather than an escrow with
extra steps. To be precise about what changes hands: the assignable asset is the
*contingent claim on the reserved fee*, not the working capital. Capital already
paid to a supplier the applicant named is spent and gone; that was the
applicant's decision, taken at issuance.

## Why this is an RWA, honestly

A tokenized invoice built in five days is a fake invoice. There is no debtor, no
legal claim, and no redemption path, just an NFT asserting something.

A documentary credit has no such problem: **it is real the moment the funds are
locked.** The instrument is a contingent claim on specific escrowed value, under
named conditions, before a named date, transferable to a third party. Every
element that makes it a financial asset is on-chain and enforceable. Nothing is
asserted off-chain and hoped for.

## Where ERC-8004 comes in, and the gap we found

The agent's identity, reputation and examination all use ERC-8004 (Trustless
Agents), the standard BOT Chain has publicly committed to.

While researching this we found that **ERC-8004 is announced on BOT Chain but not
usable on BOT Chain.** The canonical registries at `0x8004A169…a432` and
`0x8004BAa1…9b63` exist on mainnet 677 as `ERC1967Proxy` contracts pointing at
`MinimalUUPSMainnet` *placeholders*: `name()` reverts, no agent can be
registered, and the upgrade key belongs to the ERC-8004 deployer, so they cannot
be filled in by anyone else. The full evidence is in
[docs/RESEARCH.md](docs/RESEARCH.md).

So AVAL ships working registries, ported from the ERC-8004 reference
implementation with the external ABI unchanged, and a real product on top of
them. The credit contract touches nothing outside the ERC-8004 interface, so it
can be repointed at the canonical addresses unchanged if they are ever filled in.

Integration is load-bearing rather than decorative:

- The **acting key is resolved from the Identity Registry on every call**. If the
  registry does not bind a wallet to the agent, nothing can move.
- The **Validation Registry is the documentary examination.** No score over the
  presented hash, no payment.
- **Reputation is payment-backed.** The only client that writes feedback is the
  credit contract, and only for a credit that actually settled. AVAL
  deliberately does *not* take blanket ERC-721 approval over agents, because
  `giveFeedback` rejects self-feedback from an approved operator, so its
  feedback is structurally harder to fake than an arbitrary address's.

## The demo

```bash
npx hardhat run scripts/demo.ts --network botTestnet
```

An applicant locks 0.5 BOT against one job: settle an approved supplier invoice.
The mandate names one contract and one method on it.

1. **The agent tries to pay itself.** → `RecipientNotAllowed`
2. **The agent tries a forbidden method** on the *approved* contract. → `SelectorNotAllowed`
3. The agent does the job it was mandated to do. → the supplier is paid
4. The agent presents documents, on-chain, in full.
5. The examiner re-derives every claim from chain state, including reading the
   supplier's own contract to confirm the invoice was really settled, and scores it.
6. Anyone can settle: fee to the credit holder, unspent capital back to the applicant.
7. Reputation is written that only a settled credit could have produced.

Steps 1 and 2 are broadcast with gas supplied manually so they are **mined as
reverted** rather than dying in local gas estimation. The refusals become
permanent transactions on the explorer with decoded errors. That is the evidence:
not a log claiming the agent was stopped, but a block containing the attempt and
its rejection.

## Run it

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
```

Swap `botTestnet` for `botMainnet` to do it for real. To rehearse with no funds
at all, run `npx hardhat node` and use `--network localhost`.

## Deployed addresses

Written to `deployments/<chainId>.json` by the deploy script, and read from there
by every other script, no address is hardcoded twice.

All five are **verified with source** on Blockscout.

| Contract | Testnet (968) | Mainnet (677) |
| --- | --- | --- |
| IdentityRegistry | [`0xe06a0801…5ffd`](https://scan.bohr.life/address/0xe06a0801706679e73dd04917a63aa796788f5ffd) | [`0x1145970c…8e99`](https://scan.botchain.ai/address/0x1145970c4eb218a7d1a05245503a0fc05e7b8e99) |
| ReputationRegistry | [`0x8a518ab8…1fbe`](https://scan.bohr.life/address/0x8a518ab8c75c562170d71a88151cf1611b811fbe) | [`0xdd4ffa32…78ee`](https://scan.botchain.ai/address/0xdd4ffa32cd6e8b2d0afeb1ab277683ad16bb4d61) |
| ValidationRegistry | [`0x84b1bb99…c511`](https://scan.bohr.life/address/0x84b1bb992c5bb33e4cd05b32cc969683d1f3c511) | [`0x5aade5e3…e17e`](https://scan.botchain.ai/address/0x5aade5e3915168e6b7d3678cd0b054a3fbc2e17e) |
| LetterOfCredit | [`0x1145970c…8e99`](https://scan.bohr.life/address/0x1145970c4eb218a7d1a05245503a0fc05e7b8e99) | [`0xb0457f33…03e2`](https://scan.botchain.ai/address/0xb0457f336778ee33b426069b8383af3efb8503e2) |
| ServiceVendor (demo) | [`0xdd4ffa32…4d61`](https://scan.bohr.life/address/0xdd4ffa32cd6e8b2d0afeb1ab277683ad16bb4d61) | [`0x01d7aa2a…78ee`](https://scan.botchain.ai/address/0x01d7aa2a9b9b15c98ce8cf00fac6b1f825f578ee) |

A full lifecycle also ran on **mainnet**, including two refusals mined as
reverts and a settled credit; an open credit is live for anyone to inspect.

### The two transactions that are the product

A full lifecycle ran on testnet 968. These two are mined, reverted, and permanent:

| | |
| --- | --- |
| The agent tried to pay itself | [`0x001eb6da…b0b1`](https://scan.bohr.life/tx/0x001eb6da851df99a40eff70cc411ec495f6b2db04f5152c4e029be4f3c4db0b1), `RecipientNotAllowed`, block 20204469 |
| The agent tried a forbidden method on the *approved* supplier | [`0x86d0261f…b07d`](https://scan.bohr.life/tx/0x86d0261f862fb4e13d735576a6858541c59a40f3e955ef5885340932ebcfb07d), `SelectorNotAllowed`, block 20204477 |

And the rest of the same credit: [permitted job](https://scan.bohr.life/tx/0x8ad60d173cc1079242e7e811b222b2e9a0ee2282244a818a0df762e4b990a625) ·
[documents](https://scan.bohr.life/tx/0x1c1df42749c8cd1bf7807894086b071b74abcbb2d832a4176fbd1e2e7012f16b) ·
[examination 100/100](https://scan.bohr.life/tx/0x79abf3068801902e2f2e4b359560e3a695983a33699f900a3b9bfdba35844f9f) ·
[drawn](https://scan.bohr.life/tx/0xcae91adb7df6c170b91067d4287884b5deb246e1cd82dd59d5d2c3e8fbebd8e4)

## The dashboard

```bash
npx hardhat run scripts/export-abis.ts   # ABIs + addresses, generated not copied
cd web && npm install && npm run dev
```

Next.js 15, Tailwind CSS 4, motion, lenis and lucide-react. Deploys to Vercel as
-is: import the repo, set the Root Directory to `web`, deploy. There are no
environment variables, no database and no external services, the RPC endpoints
are public, and every page reads the chain on the server with a short revalidate
window.

Four surfaces, no design system:

- **Credits**, every credit, its status, and what has been spent against it.
- **Credit replay**, one timeline from issuance to settlement. The refusals are
  first-class rows, in red, with their decoded custom error, not errors hidden
  as noise.
- **Verify**, fetches the document bytes as they were emitted, re-hashes them
  **in your browser**, and reads the examiner's answer out of the Validation
  Registry. Four checks, one click, nothing taken on trust from the page.

Motion is treated as an enhancement rather than a dependency. `prefers-reduced-motion`
turns off the smooth scrolling, the background field and every reveal, and all
figures, including the refusal count, render their true values in the server
HTML before any JavaScript runs. A page whose argument is "two payments were
refused" must not say "0 refusals" while a script is still loading.
- **ERC-8004 on BOT Chain**, the canonical addresses checked live against
  mainnet, next to the registries that actually work.

One implementation note worth stating plainly, because it is the hardest part of
showing this product. **A reverted transaction emits no logs**, so no amount of
`eth_getLogs` will ever find the refusals, the exact thing worth showing is
invisible to a normal indexer. The dashboard uses the explorer's transaction
index purely to *discover* candidate hashes, then re-verifies every one against
the RPC: the receipt must really be a failure, the calldata must really name this
credit, and the revert reason is decoded by replaying the call with `eth_call`
against its parent block. If the explorer is down the timeline degrades to the
successful steps and says so, rather than silently dropping the refusals.

## Layout

```
contracts/
  LetterOfCredit.sol        the instrument: mandate, presentation, draw, dispute
  erc8004/                  Identity, Reputation, Validation, spec-conformant ports
  interfaces/IERC8004.sol   only what AVAL calls, so it stays repointable
  demo/ServiceVendor.sol    an approved supplier, for a real target to allowlist
agent/
  runtime.ts                propose → validate → authorize → submit → verify
  examiner.ts               re-derives every claim from chain state, then scores
web/
  app/credit/[id]/          the replay, and the in-browser verifier
  app/erc8004/              the canonical-vs-working registry comparison
  lib/indexer.ts            log indexing + revert recovery via eth_call replay
scripts/
  chain-check.ts            pre-flight against a live endpoint
  deploy.ts / verify.ts     deploy and Blockscout verification
  setup-agent.ts            ERC-8004 registration + EIP-712 key binding
  demo.ts                   the full lifecycle
test/credit.ts              31 tests, every mandate-violation path included
docs/RESEARCH.md            verified BOT Chain facts, incl. three corrections
```

## Design decisions worth arguing with

**The runtime's own pre-check is not the control.** `AgentRuntime.validate()`
reads the mandate and refuses bad intents before spending gas. It deliberately
does not share code with the contract, and the demo submits a forbidden intent
anyway to make the point: if the agent's reasoning is buggy, compromised, or
simply skipped, the credit still refuses. A safety property that lives in the
agent is not a safety property.

**The mandate prevents loss; the dispute governs the fee.** Working capital paid
to a destination the applicant named is gone, that was the applicant's decision,
made at issuance. A dispute therefore decides whether the agent earned its fee,
not whether the payment can be reversed. This is honest about what escrow can and
cannot do, and it is why the mandate is where the care goes.

**The acting key is resolved live, not pinned at issuance.** A principal may
legitimately rotate its agent's key, and ERC-8004 treats the currently-bound
wallet as the agent. The applicant is protected by the mandate, not by key
immutability. The wallet in force at issuance is recorded in `LetterIssued` so
the audit trail still shows it.

**A selector allowlist is not a full mandate, and this is a v1 limit.**
`execute` constrains the target contract and the 4-byte method, and does not
inspect the arguments. That is exactly right for `invoice(bytes32)`, where the
value is capped and the money can only reach one contract. It would be
insufficient for something like a DEX router, where the same selector can carry
any path and any recipient, allowlisting one would let the agent choose where
the funds end up. Argument-level constraints are the obvious next version;
until then, mandates should name contracts whose methods cannot redirect value.
The safe pattern today is `payTo` with named recipients.

**Documents go on-chain in full, not to IPFS.** At 20 gwei on a chain with
sub-second blocks, a document body costs a fraction of a cent as event data, and
it then survives without a pinning service, a gateway, or this repo staying
online. The hash is what the examiner scores, and the contract enforces that a
supplied body hashes to it, otherwise "the evidence is the event" would be a
claim rather than a guarantee. A hash-only presentation is still allowed for
documents that are bulky or confidential.

**A disputed credit is refundable after expiry.** Otherwise an examiner going
offline would strand the funds forever. The trade-off is that an applicant could
dispute and wait out the clock; the mitigations are that agents choose which
examiners they will work under, and that a credit can be presented and drawn well
before expiry with a short dispute window.

## Status

Deployed and **verified on BOT Chain testnet 968**, with a full lifecycle
executed on-chain including the two mined refusals. 31 tests passing. Contracts
are frozen.

The dashboard is built and reads live testnet state. Still to come: the mainnet
deployment, and a short demo video.

## Licence

MIT.
