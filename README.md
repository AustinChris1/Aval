# LETTER

**A letter of credit for AI agents.** Lock money against a job, an agent, a
rulebook and an examiner. The agent cannot spend outside the rulebook, and cannot
be paid without documents someone actually checked.

Built for the BOT Chain Builder Challenge #2 (AI × RWA).

---

## The problem

Agents now hold wallets. Every team shipping one gets the same question and none
of them have a good answer: *what happens when it goes wrong?*

The industry's answer so far is observability — log what the agent did, and
review it afterwards. That is a flight recorder: it tells you how you crashed. If
an agent with a funded key decides to send everything to an address it invented,
a log tells you about it after the money is gone.

Commerce solved this in the 14th century, and not with logging. A documentary
credit puts an intermediary between the payer and the beneficiary: funds are
committed up front, the beneficiary can only draw against documents that comply
with terms agreed in advance, and the payer's exposure is capped by construction.
Nobody has to trust the counterparty's good behaviour, because the counterparty
never has custody.

LETTER is that instrument, on-chain, with an ERC-8004 agent as the beneficiary.

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

Three properties follow, and each one is a test in `test/letter.ts`:

**The agent never holds the money.** The letter contract does. The agent submits
intents and the contract executes them only if the mandate permits — allowlisted
recipients, allowlisted contract *and* method, a per-call cap, a total cap, an
expiry. A forbidden payment is not a loss to chase afterwards; it reverts.

**Payment is against documents.** The fee is reserved out of the face value and
is not spendable working capital. It becomes drawable only once the examiner
named at issuance has scored the exact document hash the agent presented, at or
above the threshold written into the letter. The letter reads that score from the
ERC-8004 Validation Registry.

**The letter is itself a claim.** It is an ERC-721. Whoever holds it receives the
proceeds, so a credit can be assigned or sold — which is how documentary credits
work in the real world, and what makes this an RWA rather than an escrow with
extra steps.

## Why this is an RWA, honestly

A tokenized invoice built in five days is a fake invoice. There is no debtor, no
legal claim, and no redemption path — just an NFT asserting something.

A documentary credit has no such problem: **it is real the moment the funds are
locked.** The instrument is a contingent claim on specific escrowed value, under
named conditions, before a named date, transferable to a third party. Every
element that makes it a financial asset is on-chain and enforceable. Nothing is
asserted off-chain and hoped for.

## Where ERC-8004 comes in — and the gap we found

The agent's identity, reputation and examination all use ERC-8004 (Trustless
Agents), the standard BOT Chain has publicly committed to.

While researching this we found that **ERC-8004 is announced on BOT Chain but not
usable on BOT Chain.** The canonical registries at `0x8004A169…a432` and
`0x8004BAa1…9b63` exist on mainnet 677 as `ERC1967Proxy` contracts pointing at
`MinimalUUPSMainnet` *placeholders*: `name()` reverts, no agent can be
registered, and the upgrade key belongs to the ERC-8004 deployer, so they cannot
be filled in by anyone else. The full evidence is in
[docs/RESEARCH.md](docs/RESEARCH.md).

So LETTER ships working registries — ported from the ERC-8004 reference
implementation with the external ABI unchanged — and a real product on top of
them. The letter contract touches nothing outside the ERC-8004 interface, so it
can be repointed at the canonical addresses unchanged if they are ever filled in.

Integration is load-bearing rather than decorative:

- The **acting key is resolved from the Identity Registry on every call**. If the
  registry does not bind a wallet to the agent, nothing can move.
- The **Validation Registry is the documentary examination.** No score over the
  presented hash, no payment.
- **Reputation is payment-backed.** The only client that writes feedback is the
  letter contract, and only for a letter that actually settled. LETTER
  deliberately does *not* take blanket ERC-721 approval over agents, because
  `giveFeedback` rejects self-feedback from an approved operator — so its
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
5. The examiner re-derives every claim from chain state — including reading the
   supplier's own contract to confirm the invoice was really settled — and scores it.
6. Anyone can settle: fee to the credit holder, unspent capital back to the applicant.
7. Reputation is written that only a settled letter could have produced.

Steps 1 and 2 are broadcast with gas supplied manually so they are **mined as
reverted** rather than dying in local gas estimation. The refusals become
permanent transactions on the explorer with decoded errors. That is the evidence:
not a log claiming the agent was stopped, but a block containing the attempt and
its rejection.

## Run it

```bash
npm install
npx hardhat compile
npx hardhat test                       # 29 tests, no network needed

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
by every other script — no address is hardcoded twice.

| Contract | Mainnet (677) | Testnet (968) |
| --- | --- | --- |
| IdentityRegistry | _pending_ | _pending_ |
| ReputationRegistry | _pending_ | _pending_ |
| ValidationRegistry | _pending_ | _pending_ |
| LetterOfCredit | _pending_ | _pending_ |
| ServiceVendor (demo) | _pending_ | _pending_ |

## Layout

```
contracts/
  LetterOfCredit.sol        the instrument: mandate, presentation, draw, dispute
  erc8004/                  Identity, Reputation, Validation — spec-conformant ports
  interfaces/IERC8004.sol   only what LETTER calls, so it stays repointable
  demo/ServiceVendor.sol    an approved supplier, for a real target to allowlist
agent/
  runtime.ts                propose → validate → authorize → submit → verify
  examiner.ts               re-derives every claim from chain state, then scores
scripts/
  chain-check.ts            pre-flight against a live endpoint
  deploy.ts / verify.ts     deploy and Blockscout verification
  setup-agent.ts            ERC-8004 registration + EIP-712 key binding
  demo.ts                   the full lifecycle
test/letter.ts              29 tests, every mandate-violation path included
docs/RESEARCH.md            verified BOT Chain facts, incl. three corrections
```

## Design decisions worth arguing with

**The runtime's own pre-check is not the control.** `AgentRuntime.validate()`
reads the mandate and refuses bad intents before spending gas. It deliberately
does not share code with the contract, and the demo submits a forbidden intent
anyway to make the point: if the agent's reasoning is buggy, compromised, or
simply skipped, the letter still refuses. A safety property that lives in the
agent is not a safety property.

**The mandate prevents loss; the dispute governs the fee.** Working capital paid
to a destination the applicant named is gone — that was the applicant's decision,
made at issuance. A dispute therefore decides whether the agent earned its fee,
not whether the payment can be reversed. This is honest about what escrow can and
cannot do, and it is why the mandate is where the care goes.

**The acting key is resolved live, not pinned at issuance.** A principal may
legitimately rotate its agent's key, and ERC-8004 treats the currently-bound
wallet as the agent. The applicant is protected by the mandate, not by key
immutability. The wallet in force at issuance is recorded in `LetterIssued` so
the audit trail still shows it.

**Documents go on-chain in full, not to IPFS.** At 20 gwei on a chain with
sub-second blocks, a document body costs a fraction of a cent as event data, and
it then survives without a pinning service, a gateway, or this repo staying
online. The hash is what the examiner scores.

**A disputed letter is refundable after expiry.** Otherwise an examiner going
offline would strand the funds forever. The trade-off is that an applicant could
dispute and wait out the clock; the mitigations are that agents choose which
examiners they will work under, and that a letter can be presented and drawn well
before expiry with a short dispute window.

## Status

Contracts, tests, agent runtime, examiner and the full on-chain lifecycle are
done and passing. Still to come: the web dashboard for issuing letters and
replaying a letter's history with explorer links, and mainnet deployment with
verified source.

## Licence

MIT.
