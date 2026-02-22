import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerBurnCommand(program: Command): void {
  program
    .command("burn <from-account> <amount>")
    .description("Burn tokens from an account")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Burner keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (fromAccount, amount, opts) => {
      const spinner = ora(`Burning ${amount} tokens...`).start();
      try {
        const connection = getConnection(opts.cluster);
        const burner = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);

        const stable = await SolanaStablecoin.load(connection, mint, burner);
        const tx = await stable.burn(
          {
            fromAccount: new PublicKey(fromAccount),
            amount: BigInt(amount),
          },
          burner
        );

        spinner.succeed(chalk.green(`Burned ${amount} tokens\n  Tx: ${tx}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });
}
