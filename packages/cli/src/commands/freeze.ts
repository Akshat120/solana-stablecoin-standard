import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerFreezeCommand(program: Command): void {
  const freeze = program
    .command("freeze")
    .description("Freeze/thaw token account operations");

  freeze
    .command("account <token-account>")
    .description("Freeze a token account")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Authority keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (tokenAccount, opts) => {
      const spinner = ora(`Freezing account ${tokenAccount}...`).start();
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);

        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          authority
        );
        const tx = await stable.freeze(new PublicKey(tokenAccount), authority);
        spinner.succeed(chalk.green(`Account frozen\n  Tx: ${tx}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });

  freeze
    .command("thaw <token-account>")
    .description("Thaw a frozen token account")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Authority keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (tokenAccount, opts) => {
      const spinner = ora(`Thawing account ${tokenAccount}...`).start();
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);

        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          authority
        );
        const tx = await stable.thaw(new PublicKey(tokenAccount), authority);
        spinner.succeed(chalk.green(`Account thawed\n  Tx: ${tx}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });
}
