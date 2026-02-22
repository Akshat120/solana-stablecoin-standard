import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerSeizeCommand(program: Command): void {
  program
    .command("seize <from-account>")
    .description("Seize tokens from a blacklisted account (SSS-2)")
    .requiredOption("--to <account>", "Destination token account")
    .requiredOption("--amount <amount>", "Amount to seize")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Seizer keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (fromAccount, opts) => {
      const spinner = ora(
        `Seizing ${opts.amount} tokens from ${fromAccount}...`
      ).start();
      try {
        const connection = getConnection(opts.cluster);
        const seizer = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(connection, mint, seizer);
        const tx = await stable.compliance.seize(
          {
            fromAccount: new PublicKey(fromAccount),
            toAccount: new PublicKey(opts.to),
            amount: BigInt(opts.amount),
          },
          seizer
        );
        spinner.succeed(
          chalk.green(`Seized ${opts.amount} tokens\n  Tx: ${tx}`)
        );
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });
}
