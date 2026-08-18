# How it works

AVAL is a letter of credit where the beneficiary is a piece of software. One
party locks money against a job; the agent that does the job can spend it only
inside a rulebook written at the start, and can be paid its fee only after a
named examiner has checked the evidence. The agent never holds the money at any
point. When it tries to step outside the rules, the chain refuses the payment
and the refusal itself is recorded in a block.

Four parties, one instrument:

| Party | Who they are | What they can do |
| --- | --- | --- |
| **Applicant** | The human or treasury paying for a job | Locks the face value, writes the mandate, can dispute or cancel |
| **Agent** | An ERC-8004 identity with a bound acting wallet | Proposes payments and calls — executed only if the mandate permits |
| **Examiner** | A named party both sides accept | Scores the presented evidence 0–100; below the threshold, no fee |
| **Credit holder** | Whoever holds the credit's ERC-721 | Receives the fee at settlement; the credit can be sold or assigned |

## The lifecycle

1. **Issue.** The applicant locks the face value into the credit contract and
   writes the mandate: which addresses may be paid, which contracts and which
   exact methods may be called, a cap per call, a total, an expiry, the
   examiner's address, and the minimum score. A slice of the face value is
   reserved as the agent's fee — it is not spendable working capital.
2. **Act.** The agent's bound wallet submits intents. The contract checks each
   one against the mandate *before* any value moves. An off-mandate intent
   reverts — and because the app broadcasts these with gas supplied manually,
   the refusal is mined into a block instead of dying quietly in the wallet.
3. **Present.** When the job is done, the agent puts its evidence on-chain: the
   document bytes are emitted in an event and the contract enforces that they
   hash to the committed document hash. Presenting ends the acting phase.
4. **Examine.** The examiner reads the evidence — including re-checking claims
   against the counterparty's own contract — and writes a score into the
   ERC-8004 Validation Registry against that exact document hash.
5. **Draw.** Settlement is permissionless because every condition is on-chain:
   the named examiner must have scored this credit's agent, on this credit's
   document hash, at or above the threshold. The fee goes to the credit holder;
   unspent capital returns to the applicant; the contract writes the score into
   the agent's ERC-8004 reputation. Only a settled credit can produce that
   feedback, which is what makes the score payment-backed rather than
   self-asserted.

If things go wrong instead: the applicant can **dispute** a presentation inside
the dispute window (the examiner then rules on the fee), an expired credit
**refunds** whatever was not spent, and an untouched credit can be
**cancelled** outright.

## Say Mr. A used AVAL for his supplier payments

Mr. A runs a small electronics shop and uses a procurement agent — a script
with a wallet — to settle supplier invoices overnight. Last year a bug in a
similar bot drained a friend's hot wallet to a mistyped address, so Mr. A will
not fund an agent key directly.

Instead, on Monday he issues a credit:

- **Face value 0.08**, of which **0.01 is the agent's fee**.
- Mandate: the agent may only call `invoice()` on his approved supplier's
  contract, at most **0.02 per call**, expiring in **72 hours**.
- Examiner: an auditing service both he and the supplier accept, threshold
  **75/100**.

The 0.08 leaves Mr. A's wallet once, into the credit contract. The agent's key
holds nothing but gas money.

On Tuesday night the agent is compromised — say a poisoned dependency tries to
redirect funds to an attacker's address. The attempt is a real transaction, and
the chain answers it with `RecipientNotAllowed`, mined as a revert. Mr. A
wakes up to a crimson entry in the credit's timeline: the attack happened, cost
the attacker gas, and moved nothing. He did not have to notice in time,
because the mandate is not monitoring — it is custody.

The agent (patched) then does its actual job: it calls `invoice()` on the
supplier's contract for 0.02, which the mandate permits. It presents its
evidence — the invoice reference, the amount, the transaction — on-chain, and
the examiner independently confirms against the supplier's own contract that
the invoice was really settled, scoring it 100.

Anyone can now settle. The 0.01 fee goes to the credit's holder, Mr. A gets his
unspent 0.05 back, and the agent's ERC-8004 reputation gains a score that only
a paid-out credit could have written. When Mr. A shops for a better agent next
quarter, that number means something: it counts settled jobs, not reviews.

Total cost to Mr. A: a fraction of a cent in gas, and one decision made
up-front instead of one disaster handled afterwards.

## What the chain enforces, and what it does not

Honesty about the trust model, because escrow products routinely oversell it:

- The chain **enforces** custody, the mandate, the hash-bound evidence, the
  examiner's identity and threshold, and the settlement split.
- The chain does **not** prove the examiner was honest — the applicant chose
  them at issuance, exactly as a real documentary credit trusts its issuing
  bank to examine documents.
- The mandate constrains the target contract and the exact method, not the
  arguments inside a call. That is right for a method like `invoice()` and not
  yet sufficient for something like a DEX router; argument-level constraints
  are the next version. Plain payments to named recipients have no such caveat.
- Working capital spent on a destination the applicant *named* is spent. A
  dispute governs the fee, not a refund of authorised payments.

## Where ERC-8004 fits

Identity, examination and reputation all run on ERC-8004 (Trustless Agents),
the standard BOT Chain has committed to. The canonical registries on BOT Chain
mainnet exist only as placeholder proxies — no agent can register against them
— so AVAL deploys spec-conformant registries ported from the reference
implementation with the external ABI unchanged, and uses nothing outside the
standard interface. The day the canonical addresses are filled in, the credit
contract can be repointed at them without a code change. The full on-chain
evidence for this is in [BOT Chain research](docs/RESEARCH.md).
