#!/usr/bin/env node
import chalk from "chalk";
import Table from "cli-table3";
import * as p from "@clack/prompts";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, StablecoinStatus } from "@stbr/sss-token";
import fs from "fs";
import os from "os";
import path from "path";
import { fmt, getConnection } from "./utils";

// ─── Config (reuses the sss-token CLI config) ───────────────────────────────

const CONFIG_PATH = path.join(os.homedir(), ".config", "sss-token", "config.json");

interface CliConfig {
  cluster: string;
  keypairPath: string;
  mint?: string;
}

function loadConfig(): CliConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      cluster: "devnet",
      keypairPath: path.join(os.homedir(), ".config", "solana", "id.json"),
    };
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function loadKeypair(keypairPath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

function clearScreen() {
  process.stdout.write("\x1Bc");
}

function renderHeader(config: CliConfig) {
  console.log();
  console.log(
    chalk.bold.cyan("  ╔══════════════════════════════════════════════════════╗")
  );
  console.log(
    chalk.bold.cyan("  ║") +
      chalk.bold.white("   ◎  Solana Stablecoin Standard — Admin TUI          ") +
      chalk.bold.cyan("║")
  );
  console.log(
    chalk.bold.cyan("  ╚══════════════════════════════════════════════════════╝")
  );
  console.log(
    chalk.gray(
      `  Cluster: ${chalk.yellow(config.cluster)}  │  ` +
        `Config: ${chalk.yellow(CONFIG_PATH)}`
    )
  );
  console.log();
}

function renderDashboard(status: StablecoinStatus, authority: string) {
  const table = new Table({
    chars: { mid: "─", "left-mid": "├", "mid-mid": "┼", "right-mid": "┤" },
    style: { head: ["bold", "cyan"] },
    head: [chalk.bold.cyan("Field"), chalk.bold.cyan("Value")],
    colWidths: [24, 52],
  });

  const preset = status.complianceEnabled ? chalk.blue("SSS-2 (Compliant)") : chalk.white("SSS-1 (Minimal)");
  const statusStr = status.paused
    ? chalk.bold.red("⏸  PAUSED")
    : chalk.bold.green("▶  ACTIVE");

  table.push(
    [chalk.bold("Name"), chalk.white(status.name)],
    [chalk.bold("Symbol"), chalk.yellow.bold(status.symbol)],
    [chalk.bold("Decimals"), status.decimals.toString()],
    [chalk.bold("Standard"), preset],
    [chalk.bold("Status"), statusStr],
    ["─".repeat(22), "─".repeat(50)],
    [chalk.bold("Mint"), chalk.gray(status.mint)],
    [chalk.bold("Authority"), chalk.gray(status.authority)],
    [chalk.bold("Your Key"), chalk.gray(authority)],
    ["─".repeat(22), "─".repeat(50)],
    [chalk.bold("Total Minted"), chalk.green(fmt(status.totalMinted, status.decimals))],
    [chalk.bold("Total Burned"), chalk.red(fmt(status.totalBurned, status.decimals))],
    [chalk.bold("Current Supply"), chalk.bold.white(fmt(status.supply, status.decimals))],
  );

  console.log(chalk.bold("  Stablecoin Dashboard"));
  console.log(table.toString());
  console.log();
}

// ─── Operations ──────────────────────────────────────────────────────────────

async function opPause(stable: SolanaStablecoin, authority: Keypair) {
  const spin = p.spinner();
  spin.start("Pausing stablecoin...");
  try {
    const tx = await stable.pause(authority);
    spin.stop(chalk.green(`Paused ✓`) + chalk.gray(` tx: ${tx.slice(0, 20)}...`));
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

async function opUnpause(stable: SolanaStablecoin, authority: Keypair) {
  const spin = p.spinner();
  spin.start("Unpausing stablecoin...");
  try {
    const tx = await stable.unpause(authority);
    spin.stop(chalk.green(`Unpaused ✓`) + chalk.gray(` tx: ${tx.slice(0, 20)}...`));
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

async function opMint(stable: SolanaStablecoin, authority: Keypair) {
  const recipient = await p.text({
    message: "Recipient token account address:",
    validate: (v) => {
      try { new PublicKey(v); } catch { return "Invalid public key"; }
    },
  });
  if (p.isCancel(recipient)) return;

  const amount = await p.text({
    message: "Amount (raw units, 6 decimals → 1 token = 1000000):",
    validate: (v) => (isNaN(Number(v)) || Number(v) <= 0 ? "Must be a positive number" : undefined),
  });
  if (p.isCancel(amount)) return;

  const spin = p.spinner();
  spin.start("Minting...");
  try {
    const tx = await stable.mint({
      recipient: new PublicKey(recipient as string),
      amount: BigInt(amount as string),
      minter: authority,
    });
    spin.stop(chalk.green(`Minted ✓`) + chalk.gray(` tx: ${tx.slice(0, 20)}...`));
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

async function opBurn(stable: SolanaStablecoin, authority: Keypair) {
  const fromAccount = await p.text({
    message: "Token account to burn from:",
    validate: (v) => {
      try { new PublicKey(v); } catch { return "Invalid public key"; }
    },
  });
  if (p.isCancel(fromAccount)) return;

  const amount = await p.text({
    message: "Amount (raw units):",
    validate: (v) => (isNaN(Number(v)) || Number(v) <= 0 ? "Must be positive" : undefined),
  });
  if (p.isCancel(amount)) return;

  const spin = p.spinner();
  spin.start("Burning...");
  try {
    const tx = await stable.burn(
      { fromAccount: new PublicKey(fromAccount as string), amount: BigInt(amount as string) },
      authority
    );
    spin.stop(chalk.green(`Burned ✓`) + chalk.gray(` tx: ${tx.slice(0, 20)}...`));
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

async function opFreeze(stable: SolanaStablecoin, authority: Keypair) {
  const account = await p.text({
    message: "Token account to freeze:",
    validate: (v) => { try { new PublicKey(v); } catch { return "Invalid public key"; } },
  });
  if (p.isCancel(account)) return;

  const spin = p.spinner();
  spin.start("Freezing...");
  try {
    const tx = await stable.freeze(new PublicKey(account as string), authority);
    spin.stop(chalk.green(`Frozen ✓`) + chalk.gray(` tx: ${tx.slice(0, 20)}...`));
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

async function opThaw(stable: SolanaStablecoin, authority: Keypair) {
  const account = await p.text({
    message: "Token account to thaw:",
    validate: (v) => { try { new PublicKey(v); } catch { return "Invalid public key"; } },
  });
  if (p.isCancel(account)) return;

  const spin = p.spinner();
  spin.start("Thawing...");
  try {
    const tx = await stable.thaw(new PublicKey(account as string), authority);
    spin.stop(chalk.green(`Thawed ✓`) + chalk.gray(` tx: ${tx.slice(0, 20)}...`));
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

async function opAddMinter(stable: SolanaStablecoin, authority: Keypair) {
  const minter = await p.text({
    message: "Minter public key:",
    validate: (v) => { try { new PublicKey(v); } catch { return "Invalid public key"; } },
  });
  if (p.isCancel(minter)) return;

  const quota = await p.text({
    message: "Quota in raw units (0 = unlimited):",
    initialValue: "0",
    validate: (v) => (isNaN(Number(v)) ? "Must be a number" : undefined),
  });
  if (p.isCancel(quota)) return;

  const spin = p.spinner();
  spin.start("Registering minter...");
  try {
    const tx = await stable.updateMinter(
      { minter: new PublicKey(minter as string), quota: BigInt(quota as string), active: true },
      authority
    );
    spin.stop(chalk.green(`Minter added ✓`) + chalk.gray(` tx: ${tx.slice(0, 20)}...`));
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

async function opBlacklist(stable: SolanaStablecoin, authority: Keypair) {
  const address = await p.text({
    message: "Address to blacklist:",
    validate: (v) => { try { new PublicKey(v); } catch { return "Invalid public key"; } },
  });
  if (p.isCancel(address)) return;

  const reason = await p.text({
    message: "Reason (max 200 chars):",
    validate: (v) => (v.length > 200 ? "Too long" : undefined),
  });
  if (p.isCancel(reason)) return;

  const spin = p.spinner();
  spin.start("Blacklisting address...");
  try {
    const tx = await stable.compliance.blacklistAdd(
      { address: new PublicKey(address as string), reason: reason as string },
      authority
    );
    spin.stop(chalk.green(`Blacklisted ✓`) + chalk.gray(` tx: ${tx.slice(0, 20)}...`));
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

async function opMinterInfo(stable: SolanaStablecoin) {
  const minter = await p.text({
    message: "Minter public key:",
    validate: (v) => { try { new PublicKey(v); } catch { return "Invalid public key"; } },
  });
  if (p.isCancel(minter)) return;

  const spin = p.spinner();
  spin.start("Fetching minter info...");
  try {
    const info = await stable.getMinterInfo(new PublicKey(minter as string));
    spin.stop("");
    if (!info) {
      p.log.warn("Minter not found.");
      return;
    }
    const t = new Table({ style: { head: ["cyan"] }, head: ["Field", "Value"] });
    t.push(
      ["Minter", chalk.gray(info.minter)],
      ["Active", info.active ? chalk.green("Yes") : chalk.red("No")],
      ["Quota", info.quota === 0n ? "Unlimited" : info.quota.toLocaleString()],
      ["Minted This Period", info.mintedThisPeriod.toLocaleString()],
    );
    console.log(t.toString());
  } catch (e: any) {
    spin.stop(chalk.red(`Failed: ${e.message}`));
  }
}

// ─── Main loop ───────────────────────────────────────────────────────────────

async function main() {
  clearScreen();
  const config = loadConfig();
  renderHeader(config);

  if (!config.mint) {
    p.log.error("No mint configured. Run `sss-token init` first, or set mint in config.");
    process.exit(1);
  }

  const connection = getConnection(config.cluster);
  const authority = loadKeypair(config.keypairPath);

  p.intro(
    chalk.gray(
      `Authority: ${chalk.yellow(authority.publicKey.toBase58().slice(0, 12))}...`
    )
  );

  const spin = p.spinner();
  spin.start("Loading stablecoin...");
  let stable: SolanaStablecoin;
  try {
    stable = await SolanaStablecoin.load(connection, new PublicKey(config.mint), authority);
    const status = await stable.getStatus();
    spin.stop(chalk.green(`Loaded ${status.symbol} (${status.name})`));
    renderDashboard(status, authority.publicKey.toBase58());
  } catch (e: any) {
    spin.stop(chalk.red(`Failed to load: ${e.message}`));
    process.exit(1);
  }

  // Interactive operations loop
  while (true) {
    const action = await p.select({
      message: chalk.bold("Select operation"),
      options: [
        { value: "refresh",    label: "🔄  Refresh dashboard" },
        { value: "mint",       label: "🪙  Mint tokens" },
        { value: "burn",       label: "🔥  Burn tokens" },
        { value: "pause",      label: "⏸   Pause stablecoin" },
        { value: "unpause",    label: "▶   Unpause stablecoin" },
        { value: "freeze",     label: "❄️   Freeze token account" },
        { value: "thaw",       label: "🌊  Thaw token account" },
        { value: "addMinter",  label: "➕  Add / update minter" },
        { value: "minterInfo", label: "ℹ️   Minter info" },
        { value: "blacklist",  label: "🚫  Blacklist address (SSS-2)" },
        { value: "exit",       label: "🚪  Exit" },
      ],
    });

    if (p.isCancel(action) || action === "exit") {
      p.outro(chalk.cyan("Goodbye! ◎"));
      process.exit(0);
    }

    console.log();
    try {
      switch (action) {
        case "refresh": {
          const status = await stable.getStatus();
          renderDashboard(status, authority.publicKey.toBase58());
          break;
        }
        case "mint":       await opMint(stable, authority); break;
        case "burn":       await opBurn(stable, authority); break;
        case "pause":      await opPause(stable, authority); break;
        case "unpause":    await opUnpause(stable, authority); break;
        case "freeze":     await opFreeze(stable, authority); break;
        case "thaw":       await opThaw(stable, authority); break;
        case "addMinter":  await opAddMinter(stable, authority); break;
        case "minterInfo": await opMinterInfo(stable); break;
        case "blacklist":  await opBlacklist(stable, authority); break;
      }
    } catch (e: any) {
      p.log.error(e.message);
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(chalk.red(`Fatal: ${e.message}`));
  process.exit(1);
});
