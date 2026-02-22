import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, Preset } from "@stbr/sss-token";
import { getConnection, loadKeypair, saveConfig, loadConfig } from "../config";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new stablecoin")
    .requiredOption("--name <name>", "Token name")
    .requiredOption("--symbol <symbol>", "Token symbol")
    .option("--decimals <decimals>", "Decimal places", "6")
    .option("--uri <uri>", "Metadata URI", "")
    .option(
      "--preset <preset>",
      "Preset: sss-1 (minimal) or sss-2 (compliant)",
      "sss-1"
    )
    .option("--custom <path>", "Custom config JSON file path")
    .option("--hook-program <id>", "Transfer hook program ID (SSS-2)")
    .option("--keypair <path>", "Keypair file path")
    .option("--cluster <cluster>", "Cluster (devnet/mainnet/localnet)")
    .action(async (opts) => {
      const spinner = ora("Initializing stablecoin...").start();

      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);

        let config: any = {
          name: opts.name,
          symbol: opts.symbol,
          decimals: parseInt(opts.decimals),
          uri: opts.uri,
          authority,
        };

        if (opts.custom) {
          const customConfig = JSON.parse(fs.readFileSync(opts.custom, "utf8"));
          config = { ...config, ...customConfig };
        } else if (opts.preset === "sss-2") {
          config.preset = Preset.SSS_2;
          if (opts.hookProgram) {
            config.transferHookProgramId = new PublicKey(opts.hookProgram);
          }
        } else {
          config.preset = Preset.SSS_1;
        }

        const stable = await SolanaStablecoin.create(connection, config);

        const existingConfig = loadConfig();
        saveConfig({ ...existingConfig, mint: stable.mintAddress.toString() });

        spinner.succeed(
          chalk.green(
            `Stablecoin initialized!\n` +
              `  Mint:      ${chalk.bold(stable.mintAddress.toString())}\n` +
              `  Authority: ${authority.publicKey.toString()}\n` +
              `  Preset:    ${opts.preset}`
          )
        );
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
        process.exit(1);
      }
    });
}
