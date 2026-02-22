import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerPauseCommand(program: Command): void {
  program
    .command("pause")
    .description("Pause all stablecoin operations")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Pauser keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (opts) => {
      const spinner = ora("Pausing stablecoin...").start();
      try {
        const connection = getConnection(opts.cluster);
        const pauser = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(connection, mint, pauser);
        const tx = await stable.pause(pauser);
        spinner.succeed(chalk.green(`Paused\n  Tx: ${tx}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });

  program
    .command("unpause")
    .description("Resume stablecoin operations")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Pauser keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (opts) => {
      const spinner = ora("Unpausing stablecoin...").start();
      try {
        const connection = getConnection(opts.cluster);
        const pauser = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(connection, mint, pauser);
        const tx = await stable.unpause(pauser);
        spinner.succeed(chalk.green(`Unpaused\n  Tx: ${tx}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });
}
