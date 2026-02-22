import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, getMint } from "../config";

export function registerRolesCommand(program: Command): void {
  program
    .command("update-roles")
    .description("Update stablecoin roles")
    .option("--pauser <address>", "Pauser address")
    .option("--burner <address>", "Burner address")
    .option(
      "--blacklister <address>",
      "Blacklister address (SSS-2 only)"
    )
    .option("--seizer <address>", "Seizer address (SSS-2 only)")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Authority keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (opts) => {
      const spinner = ora("Updating roles...").start();
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        const mint = getMint(opts.mint);
        const stable = await SolanaStablecoin.load(
          connection,
          mint,
          authority
        );
        const tx = await stable.updateRoles(
          {
            pauser: opts.pauser ? new PublicKey(opts.pauser) : undefined,
            burner: opts.burner ? new PublicKey(opts.burner) : undefined,
            blacklister: opts.blacklister
              ? new PublicKey(opts.blacklister)
              : undefined,
            seizer: opts.seizer ? new PublicKey(opts.seizer) : undefined,
          },
          authority
        );
        spinner.succeed(chalk.green(`Roles updated\n  Tx: ${tx}`));
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });
}
