import { Command } from "commander";
import chalk from "chalk";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getConnection, getMint, loadKeypair } from "../config";

export function registerHoldersCommand(program: Command): void {
  program
    .command("holders")
    .description("List token holders")
    .option("--min-balance <amount>", "Minimum balance filter")
    .option("--mint <address>", "Mint address")
    .option("--keypair <path>", "Keypair file path")
    .option("--cluster <cluster>", "Cluster")
    .action(async (opts) => {
      try {
        const connection = getConnection(opts.cluster);
        const mint = getMint(opts.mint);

        const tokenAccounts = await connection.getParsedProgramAccounts(
          TOKEN_2022_PROGRAM_ID,
          {
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: mint.toBase58(),
                },
              },
            ],
          }
        );

        const minBalance = opts.minBalance
          ? BigInt(opts.minBalance)
          : 0n;
        let shown = 0;

        for (const account of tokenAccounts) {
          const parsed = (account.account.data as any).parsed;
          if (!parsed) continue;
          const balance = BigInt(
            parsed.info?.tokenAmount?.amount ?? "0"
          );
          if (balance >= minBalance) {
            const owner = parsed.info?.owner ?? "unknown";
            console.log(
              `${account.pubkey.toString()}  owner: ${owner}  balance: ${balance.toString()}`
            );
            shown++;
          }
        }

        console.log(chalk.gray(`\nTotal holders shown: ${shown}`));
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
