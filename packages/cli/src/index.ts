#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { registerInitCommand } from "./commands/init";
import { registerMintCommand } from "./commands/mint";
import { registerBurnCommand } from "./commands/burn";
import { registerFreezeCommand } from "./commands/freeze";
import { registerPauseCommand } from "./commands/pause";
import { registerStatusCommand } from "./commands/status";
import { registerBlacklistCommand } from "./commands/blacklist";
import { registerSeizeCommand } from "./commands/seize";
import { registerMintersCommand } from "./commands/minters";
import { registerRolesCommand } from "./commands/roles";
import { registerHoldersCommand } from "./commands/holders";
import { registerAuditCommand } from "./commands/audit";

const program = new Command();

program
  .name("sss-token")
  .description(
    "Solana Stablecoin Standard CLI\n" +
      "SSS-1 (Minimal) and SSS-2 (Compliant) stablecoin operations"
  )
  .version("0.1.0");

registerInitCommand(program);
registerMintCommand(program);
registerBurnCommand(program);
registerFreezeCommand(program);
registerPauseCommand(program);
registerStatusCommand(program);
registerBlacklistCommand(program);
registerSeizeCommand(program);
registerMintersCommand(program);
registerRolesCommand(program);
registerHoldersCommand(program);
registerAuditCommand(program);

program.parse(process.argv);
