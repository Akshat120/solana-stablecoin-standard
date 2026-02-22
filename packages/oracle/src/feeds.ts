/**
 * Known Switchboard on-demand feed addresses.
 *
 * Mainnet addresses are from https://ondemand.switchboard.xyz/solana/mainnet
 * Devnet: Switchboard on-demand supports fewer pairs; use MockOracle for unavailable feeds.
 *
 * To add a new feed:
 *   1. Find the aggregator address on the Switchboard explorer
 *   2. Add it under the appropriate network key
 *   3. Use SYMBOL format: "BASE/QUOTE" e.g. "EUR/USD"
 */
export const SWITCHBOARD_FEEDS: Record<string, Record<string, string>> = {
  mainnet: {
    "SOL/USD": "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR",
    "BTC/USD": "8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee",
    "ETH/USD": "HNStfhaLnqwF2ZtJUizaA9uHDAVB976r2AgTUx9LrdEo",
    "EUR/USD": "CbftKzHzCnFkqMiRvBxGEiKcFhEJSS6YahqQ3EB6eeMh",
    "BRL/USD": "GGCtJREw4xJrLVQbNMM9EvAo2Qi1T3Y7hbAjr9U7YVTB",
    "GBP/USD": "5xUoyPG9PeowJvfai5jD985LiRvo58isaHpv6GewHAFo",
  },
  devnet: {
    // Switchboard on-demand has limited devnet coverage.
    // Configure ORACLE_MOCK=true in your .env to use MockOracle for all feeds.
    "SOL/USD": "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR",
  },
};

/**
 * Fallback mock prices used when a feed is unavailable (devnet / CI).
 * Values are approximate — replace with real feeds for production.
 */
export const MOCK_PRICES: Record<string, number> = {
  "USD/USD": 1.0,
  "EUR/USD": 1.08,
  "GBP/USD": 1.27,
  "BRL/USD": 0.19,   // 1 BRL ≈ 0.19 USD
  "SOL/USD": 180.0,
  "BTC/USD": 65000.0,
  "ETH/USD": 3500.0,
  // CPI index (US CPI, base 100 = 2020 average)
  // Used for CPI-indexed stablecoins. 3.4% annual inflation example.
  "CPI/USD": 1.034,
};
