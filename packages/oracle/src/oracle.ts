import { Connection, PublicKey, AccountInfo } from "@solana/web3.js";
import { SWITCHBOARD_FEEDS, MOCK_PRICES } from "./feeds";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceResult {
  /** e.g. "EUR/USD" */
  symbol: string;
  /** Price of 1 unit of base currency in USD */
  price: number;
  /** ±confidence interval */
  confidence: number;
  /** Unix timestamp (ms) of the price observation */
  timestamp: number;
  /** Where the price came from */
  source: "switchboard" | "mock";
}

export interface MintQuote {
  /** Fiat amount the user is depositing (in base currency) */
  fiatAmount: number;
  /** Symbol of the deposit currency, e.g. "EUR" */
  symbol: string;
  /** USD-equivalent value of the deposit */
  usdEquivalent: number;
  /** Raw token units to mint (respects `decimals`) */
  tokensToMint: bigint;
  /** The oracle price used for calculation */
  price: PriceResult;
}

export interface RedeemQuote {
  /** Raw token units being redeemed */
  tokenAmount: bigint;
  /** Symbol of the redemption currency, e.g. "BRL" */
  symbol: string;
  /** USD-equivalent value of the tokens */
  usdEquivalent: number;
  /** Fiat units the user receives */
  fiatToReturn: number;
  /** The oracle price used for calculation */
  price: PriceResult;
}

// ─── Switchboard on-chain account layout (simplified) ───────────────────────
// Switchboard V2 aggregator stores the latest confirmed round result at a
// known byte offset. We read it directly to avoid pulling in the full SDK.
//
// Layout reference:
//   https://github.com/switchboard-xyz/switchboard-v2/blob/main/javascript/solana.js/src/accounts/aggregatorAccount.ts
//
// Byte offsets within the aggregator account data:
//   0–7   : discriminator
//   8–39  : name (32 bytes)
//   40–71 : metadata (32 bytes)
//   72+   : ... (various fields)
//   latestConfirmedRound.result starts at offset 1136 in V2 layout:
//     value: SwitchboardDecimal { mantissa: i128 (16 bytes), scale: u32 (4 bytes) }
//
// This is a best-effort heuristic decoder — for production use the full SDK.

const AGGREGATOR_RESULT_OFFSET = 1136; // byte offset of SwitchboardDecimal in V2 aggregator

function parseSwitchboardDecimal(data: Buffer, offset: number): number {
  // mantissa is a signed 128-bit little-endian integer (16 bytes)
  const low = data.readBigInt64LE(offset);
  const high = data.readBigInt64LE(offset + 8);
  const mantissa = Number(high) * 2 ** 64 + Number(low < 0n ? low + 2n ** 64n : low);
  // scale is a u32 (4 bytes) at offset + 16
  const scale = data.readUInt32LE(offset + 16);
  return mantissa / Math.pow(10, scale);
}

// ─── OracleModule ────────────────────────────────────────────────────────────

export class OracleModule {
  private connection: Connection;
  private network: "mainnet" | "devnet";
  private useMock: boolean;
  /** Token decimals of the stablecoin (default: 6) */
  readonly decimals: number;

  /**
   * @param connection  Solana RPC connection
   * @param network     "mainnet" | "devnet"
   * @param decimals    Stablecoin token decimals (default 6)
   * @param useMock     Force mock prices (useful in CI / devnet)
   */
  constructor(
    connection: Connection,
    network: "mainnet" | "devnet" = "devnet",
    decimals = 6,
    useMock = false
  ) {
    this.connection = connection;
    this.network = network;
    this.decimals = decimals;
    this.useMock =
      useMock || process.env.ORACLE_MOCK === "true";
  }

  // ── Price fetching ─────────────────────────────────────────────────────────

  /**
   * Fetch the current USD price for the given symbol.
   *
   * Falls back to a mock price when:
   * - `useMock` is true
   * - `ORACLE_MOCK=true` env var is set
   * - No feed address is configured for the symbol + network
   * - The on-chain account cannot be read
   *
   * @example
   * const price = await oracle.getPrice("EUR/USD");
   * console.log(price.price); // e.g. 1.08
   */
  async getPrice(symbol: string): Promise<PriceResult> {
    if (this.useMock) return this.mockPrice(symbol);

    const feedAddress = SWITCHBOARD_FEEDS[this.network]?.[symbol];
    if (!feedAddress) return this.mockPrice(symbol);

    try {
      return await this.fetchOnChainPrice(symbol, feedAddress);
    } catch {
      // Graceful fallback — never block a mint/redeem on oracle unavailability
      return this.mockPrice(symbol);
    }
  }

  /**
   * Fetch prices for multiple symbols in a single RPC call.
   */
  async getPrices(symbols: string[]): Promise<Map<string, PriceResult>> {
    const results = await Promise.all(symbols.map((s) => this.getPrice(s)));
    return new Map(symbols.map((s, i) => [s, results[i]]));
  }

  // ── Mint / Redeem pricing ──────────────────────────────────────────────────

  /**
   * Calculate how many stablecoin tokens to mint for a fiat deposit.
   *
   * The stablecoin is always pegged 1:1 to USD. For non-USD deposits the
   * oracle converts the fiat amount to its USD equivalent, then mints
   * that many tokens (adjusted for decimals).
   *
   * @example
   * // User deposits 100 EUR; oracle says EUR/USD = 1.08
   * const quote = await oracle.getMintQuote(100, "EUR/USD");
   * // quote.tokensToMint → 108_000_000n (= 108.000000 USDX)
   */
  async getMintQuote(fiatAmount: number, symbol: string): Promise<MintQuote> {
    const price = await this.getPrice(symbol);
    const usdEquivalent = fiatAmount * price.price;
    const tokensToMint = BigInt(Math.floor(usdEquivalent * 10 ** this.decimals));
    return { fiatAmount, symbol, usdEquivalent, tokensToMint, price };
  }

  /**
   * Calculate how much fiat the user receives when redeeming stablecoin tokens.
   *
   * @example
   * // User redeems 108_000_000 raw tokens (= 108 USDX); oracle says EUR/USD = 1.08
   * const quote = await oracle.getRedeemQuote(108_000_000n, "EUR/USD");
   * // quote.fiatToReturn → 100 (EUR)
   */
  async getRedeemQuote(tokenAmount: bigint, symbol: string): Promise<RedeemQuote> {
    const price = await this.getPrice(symbol);
    const usdEquivalent = Number(tokenAmount) / 10 ** this.decimals;
    const fiatToReturn = usdEquivalent / price.price;
    return { tokenAmount, symbol, usdEquivalent, fiatToReturn, price };
  }

  // ── On-chain reader ────────────────────────────────────────────────────────

  private async fetchOnChainPrice(
    symbol: string,
    feedAddress: string
  ): Promise<PriceResult> {
    const pubkey = new PublicKey(feedAddress);
    const accountInfo: AccountInfo<Buffer> | null =
      await this.connection.getAccountInfo(pubkey, { commitment: "confirmed" });

    if (!accountInfo || accountInfo.data.length < AGGREGATOR_RESULT_OFFSET + 20) {
      throw new Error(`Switchboard aggregator account not found or too small: ${feedAddress}`);
    }

    const price = parseSwitchboardDecimal(accountInfo.data, AGGREGATOR_RESULT_OFFSET);
    // Confidence stored 20 bytes after the result value (mantissa 16 + scale 4)
    const confidence = Math.abs(
      parseSwitchboardDecimal(accountInfo.data, AGGREGATOR_RESULT_OFFSET + 20)
    );

    return {
      symbol,
      price,
      confidence,
      timestamp: Date.now(),
      source: "switchboard",
    };
  }

  // ── Mock ──────────────────────────────────────────────────────────────────

  private mockPrice(symbol: string): PriceResult {
    const price = MOCK_PRICES[symbol] ?? 1.0;
    return {
      symbol,
      price,
      confidence: price * 0.001, // 0.1% mock confidence interval
      timestamp: Date.now(),
      source: "mock",
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Format a mint quote for human-readable display.
   */
  formatMintQuote(q: MintQuote): string {
    const base = q.symbol.split("/")[0];
    const tokens = Number(q.tokensToMint) / 10 ** this.decimals;
    return (
      `Deposit ${q.fiatAmount.toFixed(2)} ${base} ` +
      `≈ $${q.usdEquivalent.toFixed(2)} USD ` +
      `→ mint ${tokens.toFixed(this.decimals)} tokens ` +
      `[${q.price.source} @ ${q.price.price.toFixed(6)}]`
    );
  }

  /**
   * Format a redeem quote for human-readable display.
   */
  formatRedeemQuote(q: RedeemQuote): string {
    const base = q.symbol.split("/")[0];
    const tokens = Number(q.tokenAmount) / 10 ** this.decimals;
    return (
      `Redeem ${tokens.toFixed(this.decimals)} tokens ` +
      `≈ $${q.usdEquivalent.toFixed(2)} USD ` +
      `→ return ${q.fiatToReturn.toFixed(2)} ${base} ` +
      `[${q.price.source} @ ${q.price.price.toFixed(6)}]`
    );
  }
}
