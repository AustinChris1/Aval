# AVAL, dashboard

The web surface for [AVAL](../README.md). Four screens over live BOT Chain
state: every credit, a replay of one credit from issuance to settlement, an agent
profile, and a live comparison of ERC-8004's canonical registries against the
ones that actually work.

```bash
npm install
npm run dev            # http://localhost:3000
```

Addresses and ABIs come from `lib/generated/`, which is produced by
`npx hardhat run scripts/export-abis.ts` in the repo root. Re-run it after any
deployment so the app cannot drift from what is on-chain.

## Deploying to Vercel

The app is a stock Next.js App Router project with no external services, no
database and no environment variables, RPC endpoints are public and compiled in.

1. Import the repository in Vercel.
2. Set **Root Directory** to `web`.
3. Deploy. Framework preset, build command and output directory are all detected.

Pages revalidate on a short timer (10–30s) and read the chain on the server, so a
deployment stays current without a webhook or a cron job.

## Two implementation notes

**Reverted transactions emit no logs.** The refusals are the most important rows
in a credit's timeline and `eth_getLogs` cannot find them at all. The explorer's
transaction index is used *only* to discover candidate hashes; every candidate is
then re-verified against the RPC, the receipt must really be a failure, the
calldata must really name this credit, and the revert reason is decoded by
replaying the call with `eth_call` against its parent block. If the explorer is
unreachable, the timeline degrades to the logged steps and says so on the page
rather than silently dropping the refusals.

**The verifier does no checking server-side.** `/api/presentation` returns the
document bytes as they were emitted plus the examiner's answer; the browser
re-hashes the bytes and compares them to what the credit stored. Someone
verifying a presentation never has to trust this server.

## Stack

Next.js 15 · Tailwind CSS 4 · motion · lenis · lucide-react · viem.

Animation is deliberately restrained, a document about money moving under rules
should not read as a showreel. Everything degrades cleanly:
`prefers-reduced-motion` disables smooth scroll, the background field and every
reveal, and all figures render their true values in the server HTML before any
JavaScript runs.
