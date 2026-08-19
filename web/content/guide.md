# Using the dapp

A walkthrough for someone opening AVAL for the first time, what each page is,
what every button does, and two ways to drive the whole thing: with no wallet
at all, or end to end with your own.

Everything runs on **BOT Chain Testnet (chain 968)**. Nothing here is real
money.

## The two ways to act

Every action on the site has up to two buttons:

- **"Run as the …"**, signs with a throwaway testnet key held server-side, so
  you can drive an existing credit without owning any tBOT. These keys are
  capped, only reach AVAL's own contracts, and are refused outright on mainnet.
- **"Send from my wallet"**, signs with *your* connected wallet. This is the
  full experience: register an agent bound to your own key and you can hold
  every role yourself.

Every outcome, success, failure, or an intended refusal, lands as a toast in
the corner with a link to the transaction on the explorer.

## Connecting a wallet (optional, but the best version)

1. Install MetaMask (or any injected wallet).
2. Click **Connect wallet** in the header. The first action you send will
   prompt the wallet to *add* BOT Chain Testnet, then switch to it, approve
   both.
3. Get free tBOT from the faucet: <https://faucet.botchain.ai/basic>, up to
   10 tBOT per address per 24 hours. You only need a fraction of one.

A wrong-network state shows a **Switch to BOT Chain Testnet** button; the sun
and moon button beside it switches between the dark and light themes; clicking
your address disconnects.

## The pages

### Credits (the home page)

The register of every credit ever issued: number, status, face value, fee,
amount spent, and the beneficiary agent. The figures above it, credits issued,
settled, value moved, are read from the chain when the page loads. **open →**
takes you to a credit's own page. The hero's floating tags are live values from
the featured credit, and the crimson stamp links to a real reverted
transaction.

### Credit № (the replay)

One credit, in full:

- **Timeline**, every event from issuance to settlement, each row linking to
  its transaction. Crimson rows are refusals: attempts the mandate blocked,
  mined as reverts. They are the product working, not errors.
- **Act as the agent / Examine, then settle / Dispute, refund, cancel**, the
  interactive half. Every contract function, as a form (see the table below).
  An amber note on a form means the credit's current status will refuse that
  action; you can still send it and read the contract's own answer.
- **The mandate**, the rulebook written at issuance: named recipients, named
  contracts, permitted methods, caps, expiry.
- **Parties**, applicant, agent, credit holder, examiner, threshold.
- **Verify the presentation yourself**, fetches the document bytes exactly as
  they were emitted, re-hashes them *in your browser*, and reads the
  examiner's answer from the ERC-8004 registry. Four checks; nothing taken on
  trust from the page.

### Issue

Create your own credit. Register an agent first (one click, the address that
registers becomes both the owner and the acting wallet), then fill the mandate
form: face value, fee, per-call cap, expiry, dispute window, examiner,
threshold, and the three allowlists. Leave the recipient list empty and any
plain payment will be refused; name a contract but not a method and calls will
be. Issuing locks real (test) value, so it is wallet-only by design.

### ERC-8004

A live check, run on every page load, of the canonical ERC-8004 registry
addresses on BOT Chain mainnet, which are placeholder proxies where `name()`
reverts, beside AVAL's working registries on testnet. The integration story,
provable in the page itself.

### Docs

You are here.

## Every function, in one table

| Action | Sent by | What it does |
| --- | --- | --- |
| Register an agent | anyone | Mints an ERC-8004 identity; the sender becomes owner and acting wallet |
| Issue | applicant (wallet-only) | Locks the face value under a mandate; mints the credit as an ERC-721 |
| Attempt a payment the mandate forbids | agent | Expected to fail, broadcast so the refusal is mined into a block |
| Pay a named recipient | agent | Moves working capital to an allowlisted address |
| Call a named contract | agent | Calls an allowlisted contract + method, funded by the credit |
| Present documents | agent | Puts the evidence on-chain (body must hash to the committed hash); ends acting |
| Request examination | agent's owner | Asks the named examiner to attest the document hash |
| Answer the examination | examiner | Scores the hash 0–100 in the Validation Registry |
| Draw the credit | anyone | Pays the fee to the holder, returns the rest, only if score ≥ threshold |
| Dispute the presentation | applicant | Contests inside the dispute window; examiner then rules on the fee |
| Resolve the dispute | examiner | For the agent: fee pays out. Against: fee withheld, capital returns |
| Refund after expiry | anyone | Returns unspent value to the applicant once the credit expires |
| Cancel | applicant | Withdraws an untouched credit entirely |

## A five-minute test drive (no wallet needed)

1. Open the home page, find a credit stamped **OPEN**, click **open →**.
2. Expand **Attempt a payment the mandate forbids**. The recipient is blank on
   purpose, paste any address; the agent's own key (pre-filled in the help
   text) is the honest demonstration. Click **Run as the agent**.
3. Wait a few seconds. A crimson toast: *refused, recorded on-chain*. Open the
   explorer link, a real transaction, status failed, in a real block. Reload
   and it is now a crimson row in the timeline, permanently.
4. Expand **Call a named contract**, the fields are pre-filled with the one
   call the mandate permits. Run it: a gold toast, and the supplier is paid.
5. **Present documents** (pre-filled evidence), then **Request examination**,
   then **Answer the examination** with a score of 100, each role has its own
   demo key, so you just played agent, owner and examiner in turn.
6. **Draw the credit.** Settlement splits the money; the timeline now reads
   issue → refusal → job → presentation → examination → drawn, and the agent's
   page shows a reputation only this settlement could have written.
7. Click **Verify the presentation yourself** and watch your own browser
   re-derive the hash.

## Troubleshooting

- **"BadStatus(4, 1)"**, the credit is Settled and the agent may only act on
  an Open one. Pick a credit stamped OPEN, or issue your own.
- **"NotAgentWallet"**, you sent an agent action from a wallet that is not
  the agent's bound key. That refusal *is* the identity model working. Register
  your own agent on the Issue page to act with your own wallet.
- **"Recipient is required"**, the blocked-payment form ships empty on
  purpose; type an address.
- **Wallet stuck on the wrong network**, click the red **Switch** button;
  approve both the add-network and switch prompts.
- **"Demo keys are not configured"**, that deployment has no server keys;
  connect a wallet instead.
- **Score below 75 then draw fails with "ScoreBelowThreshold"**, intended.
  Re-answering the examination with a passing score unblocks the draw.
