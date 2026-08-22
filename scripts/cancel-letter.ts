// Cancels an unspent Open credit as the applicant, returning its face value: LETTER_ID=2 npx hardhat run scripts/cancel-letter.ts --network botMainnet
import { connect, banner, txLink } from "./lib/context.ts";

const id = BigInt(process.env.LETTER_ID ?? "0");
if (id === 0n) throw new Error("Set LETTER_ID to the credit to cancel.");

const ctx = await connect();
banner(`Cancelling credit #${id} on chain ${ctx.chainId}`);

const letter = await ctx.contracts.letter(ctx.roles.applicant);
const tx = await letter.write.cancel([id]);
await ctx.publicClient.waitForTransactionReceipt({ hash: tx });

console.log(`  credit #${id} cancelled, unspent balance returned to the applicant`);
console.log(`  tx ${txLink(ctx.explorer, tx)}`);
