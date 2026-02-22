import fs from "fs";
import path from "path";
import os from "os";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";

export interface CliConfig {
  cluster: string;
  keypairPath: string;
  mint?: string;
  programId?: string;
}

const CONFIG_PATH = path.join(
  os.homedir(),
  ".config",
  "sss-token",
  "config.json"
);

export function loadConfig(): CliConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      cluster: "devnet",
      keypairPath: path.join(
        os.homedir(),
        ".config",
        "solana",
        "id.json"
      ),
    };
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

export function saveConfig(config: CliConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getConnection(cluster?: string): Connection {
  const c = cluster ?? loadConfig().cluster;
  if (c === "localnet" || c === "localhost") {
    return new Connection("http://localhost:8899", "confirmed");
  }
  return new Connection(clusterApiUrl(c as any), "confirmed");
}

export function loadKeypair(keypairPath?: string): Keypair {
  const p = keypairPath ?? loadConfig().keypairPath;
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

export function getMint(mintArg?: string): PublicKey {
  const m = mintArg ?? loadConfig().mint;
  if (!m) {
    throw new Error(
      "No mint address. Use --mint <address> or run sss-token init first."
    );
  }
  return new PublicKey(m);
}
