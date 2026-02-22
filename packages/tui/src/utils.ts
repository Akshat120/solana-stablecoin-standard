import { Connection } from "@solana/web3.js";

/**
 * Format a raw token amount (bigint) as a human-readable decimal string.
 *
 * @example
 * fmt(1_000_000n, 6) → "1.000000"
 * fmt(108_500_000n, 6) → "108.500000"
 * fmt(0n, 6) → "0.000000"
 */
export function fmt(n: bigint, decimals = 6): string {
  if (decimals === 0) {
    return `${Number(n).toLocaleString("en-US")}.`;
  }
  const s = n.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals) || "0";
  const frac = s.slice(-decimals);
  // Use "en-US" locale explicitly so output is consistent across environments.
  return `${Number(whole).toLocaleString("en-US")}.${frac}`;
}

const RPC_URLS: Record<string, string> = {
  devnet:    "https://api.devnet.solana.com",
  mainnet:   "https://api.mainnet-beta.solana.com",
  testnet:   "https://api.testnet.solana.com",
  localhost: "http://localhost:8899",
  localnet:  "http://localhost:8899",
};

/**
 * Resolve a cluster name or raw URL to a Connection.
 * Falls back to treating the value as a raw RPC URL.
 */
export function getConnection(cluster: string): Connection {
  return new Connection(RPC_URLS[cluster] ?? cluster, "confirmed");
}

/**
 * Return the RPC URL string for a given cluster (for testing without creating a Connection).
 */
export function resolveRpcUrl(cluster: string): string {
  return RPC_URLS[cluster] ?? cluster;
}
