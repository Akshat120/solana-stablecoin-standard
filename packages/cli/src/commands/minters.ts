import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerMintersCommand(program: Command): void {
  const minters = program
    .command("minters")
    .description("Manage minters");

  minters
    .command("add <minter>")
    .description("Add a new minter")
    .option("--quota <amount>", "Mint quota (0 = unlimited)", "0")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Authority keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (minter, opts) => {
      const spinner = ora(`Adding minter ${minter}...`).start();
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          authority
        );
        const tx = await stable.updateMinter(
          {
            minter: new PublicKey(minter),
            quota: BigInt(opts.quota),
            active: true,
          },
          authority
        );
        spinner.succeed(chalk.green(`Minter added\n  Tx: ${tx}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });

  minters
    .command("remove <minter>")
    .description("Deactivate a minter")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Authority keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (minter, opts) => {
      const spinner = ora(`Removing minter ${minter}...`).start();
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          authority
        );
        const tx = await stable.updateMinter(
          {
            minter: new PublicKey(minter),
            quota: 0n,
            active: false,
          },
          authority
        );
        spinner.succeed(
          chalk.green(`Minter deactivated\n  Tx: ${tx}`)
        );
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });

  minters
    .command("info <minter>")
    .description("Get minter info")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (minter, opts) => {
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          authority
        );
        const info = await stable.getMinterInfo(new PublicKey(minter));
        if (!info) {
          console.log(chalk.yellow("Minter not found"));
          return;
        }
        console.log(`Minter:            ${info.minter}`);
        console.log(
          `Quota:             ${
            info.quota === 0n ? "unlimited" : info.quota.toString()
          }`
        );
        console.log(`Minted this period: ${info.mintedThisPeriod}`);
        console.log(
          `Active:            ${
            info.active ? chalk.green("YES") : chalk.red("NO")
          }`
        );
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
