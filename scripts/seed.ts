/**
 * Seed script — sends real transactions to the stablecoin program on devnet
 * so the indexer captures live events.
 *
 * Run: npx ts-node --compiler-options '{"target":"ES2020"}' scripts/seed.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { readFileSync } from "fs";
import { homedir } from "os";
import path from "path";
import {
  SolanaStablecoin,
} from "../packages/sdk/src/stablecoin";
import { Preset } from "../packages/sdk/src/types";

const RPC_URL = "https://api.devnet.solana.com";

function loadKeypair(filePath: string): Keypair {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const authority = loadKeypair(path.join(homedir(), ".config/solana/id.json"));

  console.log("Authority:", authority.publicKey.toString());
  const balance = await connection.getBalance(authority.publicKey);
  console.log("Balance:", balance / 1e9, "SOL\n");

  // ── Step 1: Create stablecoin (SSS-1 preset) ─────────────────────────────
  console.log("Step 1: Creating stablecoin (SSS-1)...");
  const stable = await SolanaStablecoin.create(connection, {
    preset: Preset.SSS_1,
    name: "Test USD",
    symbol: "TUSD",
    decimals: 6,
    authority,
  });
  console.log("✓ StablecoinInitialized event emitted");
  console.log("  Mint:", stable.mintAddress.toString(), "\n");

  // ── Step 2: Register authority as minter ─────────────────────────────────
  console.log("Step 2: Registering authority as minter...");
  await stable.updateMinter(
    { minter: authority.publicKey, quota: BigInt(0), active: true },
    authority
  );
  console.log("✓ MinterUpdated event emitted\n");

  // ── Step 3: Create recipient token account ────────────────────────────────
  console.log("Step 3: Creating recipient token account...");
  const ataAddress = getAssociatedTokenAddressSync(
    stable.mintAddress,
    authority.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const createAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      authority.publicKey,
      ataAddress,
      authority.publicKey,
      stable.mintAddress,
      TOKEN_2022_PROGRAM_ID
    )
  );
  await sendAndConfirmTransaction(connection, createAtaTx, [authority]);
  console.log("✓ Token account created:", ataAddress.toString(), "\n");

  // ── Step 4: Mint 1000 TUSD ────────────────────────────────────────────────
  console.log("Step 4: Minting 1,000 TUSD...");
  const mintTx = await stable.mint({
    recipient: authority.publicKey,
    amount: BigInt("1000000000"), // 1000 tokens (6 decimals)
    minter: authority,
  });
  console.log("✓ TokensMinted event emitted");
  console.log("  Tx:", mintTx, "\n");

  // ── Step 5: Pause then unpause ────────────────────────────────────────────
  console.log("Step 5: Pausing stablecoin...");
  const pauseTx = await stable.pause(authority);
  console.log("✓ StablecoinPaused event emitted — tx:", pauseTx);

  console.log("Step 6: Unpausing stablecoin...");
  const unpauseTx = await stable.unpause(authority);
  console.log("✓ StablecoinUnpaused event emitted — tx:", unpauseTx, "\n");

  // ── Step 6: Final status ──────────────────────────────────────────────────
  const status = await stable.getStatus();
  console.log("── Stablecoin Status ──────────────────────────");
  console.log("  Name:        ", status.name);
  console.log("  Symbol:      ", status.symbol);
  console.log("  Total Minted:", status.totalMinted.toString());
  console.log("  Supply:      ", status.supply.toString());
  console.log("  Paused:      ", status.paused);
  console.log("───────────────────────────────────────────────\n");

  console.log("Done! Now check the indexer:");
  console.log("  curl http://localhost:3002/api/events");
  console.log("  curl http://localhost:3002/api/events/count");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
