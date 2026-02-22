import { Command } from "commander";
import chalk from "chalk";
import { table } from "table";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show stablecoin status and configuration")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (opts) => {
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(connection, mint, authority);
        const status = await stable.getStatus();

        const decimals = status.decimals;
        const supplyFormatted = (
          Number(status.supply) /
          10 ** decimals
        ).toFixed(decimals);

        const data = [
          ["Field", "Value"],
          ["Mint", status.mint],
          ["Name", status.name],
          ["Symbol", status.symbol],
          ["Decimals", status.decimals.toString()],
          ["Supply", supplyFormatted],
          [
            "Paused",
            status.paused ? chalk.red("YES - PAUSED") : chalk.green("NO"),
          ],
          [
            "Compliance (SSS-2)",
            status.complianceEnabled
              ? chalk.yellow("ENABLED")
              : chalk.gray("Disabled (SSS-1)"),
          ],
          ["Authority", status.authority],
          ["Total Minted", status.totalMinted.toString()],
          ["Total Burned", status.totalBurned.toString()],
        ];

        console.log(table(data));
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  program
    .command("supply")
    .description("Get current token supply")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (opts) => {
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(connection, mint, authority);
        const supply = await stable.getTotalSupply();
        console.log(chalk.bold(`Supply: ${supply.toString()}`));
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
