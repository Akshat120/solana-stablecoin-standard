import { Command } from "commander";
import chalk from "chalk";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerAuditCommand(program: Command): void {
  program
    .command("audit-log")
    .description("Export compliance audit log (SSS-2)")
    .option("--action <type>", "Filter by action type")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          authority
        );
        const log = await stable.compliance.getAuditLog();

        if (opts.json) {
          console.log(JSON.stringify(log, null, 2));
        } else {
          for (const entry of log) {
            console.log(
              `[${entry.timestamp}] ${chalk.red(entry.address)} — ${
                entry.reason
              } (by ${entry.addedBy})`
            );
          }
          console.log(chalk.gray(`\nTotal entries: ${log.length}`));
        }
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
