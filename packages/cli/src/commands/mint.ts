import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerMintCommand(program: Command): void {
  program
    .command("mint <recipient> <amount>")
    .description("Mint tokens to a recipient")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Minter keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (recipient, amount, opts) => {
      const spinner = ora(
        `Minting ${amount} tokens to ${recipient}...`
      ).start();
      try {
        const connection = getConnection(opts.cluster);
        const minter = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);

        const stable = await SolanaStablecoin.load(connection, mint, minter);
        const tx = await stable.mint({
          recipient: new PublicKey(recipient),
          amount: BigInt(amount),
          minter,
        });

        spinner.succeed(chalk.green(`Minted ${amount} tokens\n  Tx: ${tx}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });
}
