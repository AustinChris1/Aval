# Submission pack

Everything needed for the Challenge #2 form, the demo video, and Demo Day.
Deadline: **22 Aug 2026, 23:59 UTC+8**. Demo Day 24 Aug.

## One-liner

A letter of credit for AI agents: lock money against a job, an agent, a rulebook
and an examiner — the agent cannot spend outside the rulebook, and cannot be paid
without documents someone actually checked.

## Track

**RWA Applications**, with an AI-native agent as the method. The instrument is a
documentary credit: a contingent claim on escrowed value, under named conditions,
before a named date, transferable to a third party. It is real the moment the
funds are locked — unlike a tokenized invoice, which in five days is a fake
invoice with no debtor and no redemption path.

## The 60-second pitch

> Agents now hold wallets, and the industry's answer to "what if it goes wrong"
> is a log you read afterwards. That is a flight recorder: it tells you how you
> crashed.
>
> Commerce solved this in the 14th century with the documentary credit. The payer
> commits funds up front, the beneficiary can only draw against documents that
> comply with terms agreed in advance, and the counterparty never has custody.
>
> LETTER is that instrument on-chain, with an ERC-8004 agent as the beneficiary.
> The agent never holds the money — the letter does, and it executes the agent's
> intents only when the mandate permits. When our agent tried to pay itself, the
> chain refused, and you can open that transaction. When it tried a forbidden
> method on an approved supplier, the chain refused that too.
>
> BOT Chain reserved the ERC-8004 vanity addresses and announced Launchpad
> support. On mainnet those addresses are empty UUPS placeholders — `name()`
> reverts, no agent can register, and we do not hold the upgrade key. So LETTER
> deploys spec-conformant registries and puts a real financial instrument on top
> of them.

## Demo video script (~90 seconds, screen only, no narration needed)

1. **0:00** — Dashboard home. One letter, `Settled`. Point at the deployment
   addresses, all verified.
2. **0:10** — Open the letter replay. Let the timeline sit on screen for a beat:
   the two red rows are in the middle of a successful lifecycle.
3. **0:20** — Hover/zoom the first red row:
   `RecipientNotAllowed(0x0236…c629)`. Click through to the explorer. Show
   **status: reverted**, in a real block. This is the shot.
4. **0:35** — Back, second red row: `SelectorNotAllowed(0x51cff8d9)`. Say (or
   caption) that the *contract* was approved and the *method* was not.
5. **0:45** — Scroll to the mandate panel: one named contract, one permitted
   method, per-call cap, expiry.
6. **0:55** — Click **Verify this presentation**. Four checks go green. Caption:
   the hash is recomputed in the browser, not asserted by the page.
7. **1:10** — The ERC-8004 page. Canonical addresses: `placeholder`,
   `name() reverts`. Ours: `working`, `name() = "AgentIdentity"`, 1 agent
   registered.
8. **1:25** — End on the settlement row: fee to the credit holder, capital back
   to the applicant, scored 100/100.

Record with the terminal demo as a fallback B-roll: `scripts/demo.ts` prints the
same story with explorer links.

## Live artifacts (testnet 968)

| | |
| --- | --- |
| Agent tried to pay itself | [`0x001eb6da…b0b1`](https://scan.bohr.life/tx/0x001eb6da851df99a40eff70cc411ec495f6b2db04f5152c4e029be4f3c4db0b1) — reverted, block 20204469 |
| Agent tried a forbidden method | [`0x86d0261f…b07d`](https://scan.bohr.life/tx/0x86d0261f862fb4e13d735576a6858541c59a40f3e955ef5885340932ebcfb07d) — reverted, block 20204477 |
| Permitted job | [`0x8ad60d17…a625`](https://scan.bohr.life/tx/0x8ad60d173cc1079242e7e811b222b2e9a0ee2282244a818a0df762e4b990a625) |
| Documents presented | [`0x1c1df427…f16b`](https://scan.bohr.life/tx/0x1c1df42749c8cd1bf7807894086b071b74abcbb2d832a4176fbd1e2e7012f16b) |
| Examined 100/100 | [`0x79abf306…4f9f`](https://scan.bohr.life/tx/0x79abf3068801902e2f2e4b359560e3a695983a33699f900a3b9bfdba35844f9f) |
| Drawn | [`0xcae91adb…d8e4`](https://scan.bohr.life/tx/0xcae91adb7df6c170b91067d4287884b5deb246e1cd82dd59d5d2c3e8fbebd8e4) |

Contracts (all verified): `LetterOfCredit`
[`0x1145970c…8e99`](https://scan.bohr.life/address/0x1145970c4eb218a7d1a05245503a0fc05e7b8e99) ·
`IdentityRegistry` [`0xe06a0801…5ffd`](https://scan.bohr.life/address/0xe06a0801706679e73dd04917a63aa796788f5ffd) ·
`ReputationRegistry` [`0x8a518ab8…1fbe`](https://scan.bohr.life/address/0x8a518ab8c75c562170d71a88151cf1611b811fbe) ·
`ValidationRegistry` [`0x84b1bb99…c511`](https://scan.bohr.life/address/0x84b1bb992c5bb33e4cd05b32cc969683d1f3c511)

## Measured cost

A complete run — deploy five contracts, verify all of them, register an agent,
and execute the full lifecycle — cost **0.16 BOT in gas** at 20 gwei. The
demo letter's own float was 0.5 BOT, of which 0.25 returned to the applicant,
0.05 went to the credit holder as the fee, and 0.2 reached the supplier contract.

The 1 BOT mainnet gas grant covers this several times over.

## Mainnet runbook

Contracts are frozen. In order:

```bash
npx hardhat test                                            # 31 green
npx hardhat run scripts/chain-check.ts  --network botMainnet
npx hardhat run scripts/deploy.ts       --network botMainnet
npx hardhat run scripts/verify.ts       --network botMainnet
npx hardhat run scripts/setup-agent.ts  --network botMainnet
npx hardhat run scripts/demo.ts         --network botMainnet
npx hardhat run scripts/export-abis.ts                      # point the app at 677
```

Needs roughly **0.25 BOT** on the deployer and **0.2 BOT** on the applicant, plus
a little on the agent and examiner for gas. Consider a smaller face value on
mainnet (`FACE`/`FEE`/`PER_CALL` in `scripts/demo.ts`) — nothing about the
argument depends on the size of the numbers.

## Known limits, stated up front

Judges respect a team that names these before they are asked.

- **A selector allowlist is not an argument allowlist.** `execute` constrains the
  target contract and the 4-byte method, not the calldata after it. Correct for
  `invoice(bytes32)`; insufficient for something like a DEX router, where one
  selector can carry any path and any recipient. Argument-level constraints are
  the next version. Today, mandates should name contracts whose methods cannot
  redirect value — or use `payTo` with named recipients.
- **The examiner is trusted.** The chain enforces that the examiner named at
  issuance scored this exact hash above this threshold. It does not prove the
  examiner was honest. That is the real letter-of-credit model, where the issuing
  bank is trusted to examine documents.
- **The mandate prevents loss; the dispute governs the fee.** Working capital paid
  to a destination the applicant named is gone. A dispute decides whether the
  agent earned its fee, not whether a payment can be unwound.
- **The demo supplier is our own contract.** B DEX's published router addresses
  revert on `WETH()` and `factory()`, so depending on it would have been a
  demo-day risk. `ServiceVendor` stands in for a supplier the applicant approved.
  The product is the mandate and the refusals, not the counterparty.
