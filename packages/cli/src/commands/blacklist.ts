import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerBlacklistCommand(program: Command): void {
  const blacklist = program
    .command("blacklist")
    .description("Manage the compliance blacklist (SSS-2)");

  blacklist
    .command("add <address>")
    .description("Add an address to the blacklist")
    .requiredOption("--reason <reason>", "Reason for blacklisting")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Blacklister keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (address, opts) => {
      const spinner = ora(`Blacklisting ${address}...`).start();
      try {
        const connection = getConnection(opts.cluster);
        const blacklister = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          blacklister
        );
        const tx = await stable.compliance.blacklistAdd(
          { address: new PublicKey(address), reason: opts.reason },
          blacklister
        );
        spinner.succeed(
          chalk.green(`Blacklisted ${address}\n  Tx: ${tx}`)
        );
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });

  blacklist
    .command("remove <address>")
    .description("Remove an address from the blacklist")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Blacklister keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (address, opts) => {
      const spinner = ora(
        `Removing ${address} from blacklist...`
      ).start();
      try {
        const connection = getConnection(opts.cluster);
        const blacklister = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          blacklister
        );
        const tx = await stable.compliance.blacklistRemove(
          new PublicKey(address),
          blacklister
        );
        spinner.succeed(
          chalk.green(`Removed from blacklist\n  Tx: ${tx}`)
        );
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });

  blacklist
    .command("check <address>")
    .description("Check if an address is blacklisted")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (address, opts) => {
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          authority
        );
        const blacklisted = await stable.compliance.isBlacklisted(
          new PublicKey(address)
        );
        if (blacklisted) {
          const entry = await stable.compliance.getBlacklistEntry(
            new PublicKey(address)
          );
          console.log(chalk.red(`BLACKLISTED`));
          if (entry) {
            console.log(`  Reason: ${entry.reason}`);
            console.log(
              `  Added:  ${new Date(entry.timestamp * 1000).toISOString()}`
            );
            console.log(`  By:     ${entry.addedBy}`);
          }
        } else {
          console.log(chalk.green("NOT blacklisted"));
        }
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
