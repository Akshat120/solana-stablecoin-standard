import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const PROGRAM_ID = new PublicKey("CEKm6ppyaCKcTczqALo6k3tpBSaLvhLEKqy7ao3vXdbV");

console.log("Subscribing to logs on devnet...");
connection.onLogs(PROGRAM_ID, (logs: any, ctx: any) => {
  console.log("GOT LOGS:", JSON.stringify({ slot: ctx.slot, logs: logs.logs }, null, 2));
}, "confirmed");

console.log("Waiting 8s for any incoming logs...");
setTimeout(() => {
  console.log("Test done.");
  process.exit(0);
}, 8000);
