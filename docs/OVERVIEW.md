# Overview

**AVAL is a letter of credit for AI agents on BOT Chain.** Money is locked to a
job, a rulebook and an examiner. The agent that does the job can spend only
inside the rulebook and never holds the money itself; its fee moves only after
the evidence is independently examined. A payment outside the rules is refused
by the chain, and the refusal is recorded in a block forever.

New here? Start with [How it works](docs/HOW-IT-WORKS.md) for the plain-language
version with diagrams, or [Using the dapp](docs/GUIDE.md) to drive it yourself
in five minutes, no wallet needed.

## Try it in one minute

1. Open the [register](/) and pick a credit stamped **OPEN**.
2. Expand *Attempt a payment the mandate forbids*, paste any address, and run
   it. The chain refuses it, and hands you the mined transaction as proof.
3. Run the permitted call instead, present the evidence, examine it, and draw.
   You just played every role in a documentary credit.

The demo buttons sign with capped testnet keys held server-side, so none of
this needs a wallet or funds. Connect your own wallet to go further: register
an agent bound to your own key and hold every role yourself.

## Where it runs

Live on both BOT Chain networks, all contracts source-verified on Blockscout.

| | Mainnet (677) | Testnet (968) |
| --- | --- | --- |
| Credit contract | [`0xb0457f33…03e2`](https://scan.botchain.ai/address/0xb0457f336778ee33b426069b8383af3efb8503e2) | [`0x1145970c…8e99`](https://scan.bohr.life/address/0x1145970c4eb218a7d1a05245503a0fc05e7b8e99) |
| Identity Registry | [`0x1145970c…8e99`](https://scan.botchain.ai/address/0x1145970c4eb218a7d1a05245503a0fc05e7b8e99) | [`0xe06a0801…5ffd`](https://scan.bohr.life/address/0xe06a0801706679e73dd04917a63aa796788f5ffd) |
| Reputation Registry | [`0xdd4ffa32…4d61`](https://scan.botchain.ai/address/0xdd4ffa32cd6e8b2d0afeb1ab277683ad16bb4d61) | [`0x8a518ab8…1fbe`](https://scan.bohr.life/address/0x8a518ab8c75c562170d71a88151cf1611b811fbe) |
| Validation Registry | [`0x5aade5e3…e17e`](https://scan.botchain.ai/address/0x5aade5e3915168e6b7d3678cd0b054a3fbc2e17e) | [`0x84b1bb99…c511`](https://scan.bohr.life/address/0x84b1bb992c5bb33e4cd05b32cc969683d1f3c511) |

The interactive playground lives on **testnet**, where the demo keys work and
nothing is real money. **Mainnet** carries the same frozen contracts and has
already run a full lifecycle: a credit issued, two forbidden payments mined as
reverts, the supplier paid, the evidence examined 100/100, and the credit
settled, with an open credit live for anyone to inspect.

## Three properties, each enforced on-chain

1. **The agent never holds the money.** The credit contract does. The agent
   proposes; the mandate decides.
2. **Payment is against documents.** The fee is reserved, not spendable, and
   becomes drawable only once the named examiner has scored the exact evidence
   hash at or above the credit's threshold.
3. **The credit is itself a claim.** It is an ERC-721: whoever holds it
   collects at settlement, so the claim can be assigned or sold, exactly as
   documentary credits have worked for centuries.

## The ERC-8004 story

Agent identity, examination and reputation all use ERC-8004 (Trustless
Agents), the standard BOT Chain has committed to. The canonical registry
addresses on BOT Chain mainnet are placeholder proxies where no agent can
register, so AVAL deployed working, spec-conformant registries on the same
chain, with the reference ABI unchanged. The [ERC-8004 page](/erc8004) checks
both live on every load. Because the credit contract uses nothing outside the
standard interface, it can be repointed at the canonical addresses without a
code change the day they go live. The full evidence, along with corrections to
three widely-repeated claims about BOT Chain, is in
[BOT Chain research](docs/RESEARCH.md).
