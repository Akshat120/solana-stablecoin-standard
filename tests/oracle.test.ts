import { expect } from "chai";
import { Connection } from "@solana/web3.js";
import { OracleModule, MOCK_PRICES, SWITCHBOARD_FEEDS } from "../packages/oracle/src";

// All tests run in mock mode — no network calls, fully deterministic.
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

function makeOracle(decimals = 6): OracleModule {
  return new OracleModule(connection, "devnet", decimals, /* useMock */ true);
}

describe("OracleModule", () => {
  // ── getPrice ────────────────────────────────────────────────────────────────

  describe("getPrice()", () => {
    it("returns a mock PriceResult with source='mock'", async () => {
      const oracle = makeOracle();
      const result = await oracle.getPrice("EUR/USD");
      expect(result.source).to.equal("mock");
      expect(result.symbol).to.equal("EUR/USD");
    });

    it("returns correct mock price for EUR/USD", async () => {
      const oracle = makeOracle();
      const result = await oracle.getPrice("EUR/USD");
      expect(result.price).to.equal(MOCK_PRICES["EUR/USD"]);
      expect(result.price).to.be.closeTo(1.08, 0.001);
    });

    it("returns correct mock price for BRL/USD", async () => {
      const oracle = makeOracle();
      const result = await oracle.getPrice("BRL/USD");
      expect(result.price).to.equal(MOCK_PRICES["BRL/USD"]);
      expect(result.price).to.be.closeTo(0.19, 0.001);
    });

    it("returns correct mock price for SOL/USD", async () => {
      const oracle = makeOracle();
      const result = await oracle.getPrice("SOL/USD");
      expect(result.price).to.equal(MOCK_PRICES["SOL/USD"]);
    });

    it("returns mock price for CPI/USD", async () => {
      const oracle = makeOracle();
      const result = await oracle.getPrice("CPI/USD");
      expect(result.price).to.equal(MOCK_PRICES["CPI/USD"]);
      expect(result.price).to.be.above(1.0); // CPI-indexed > 1.0
    });

    it("falls back to 1.0 for unknown symbols", async () => {
      const oracle = makeOracle();
      const result = await oracle.getPrice("UNKNOWN/USD");
      expect(result.price).to.equal(1.0);
      expect(result.source).to.equal("mock");
    });

    it("includes a positive confidence interval", async () => {
      const oracle = makeOracle();
      const result = await oracle.getPrice("EUR/USD");
      expect(result.confidence).to.be.above(0);
    });

    it("includes a recent timestamp", async () => {
      const before = Date.now();
      const oracle = makeOracle();
      const result = await oracle.getPrice("EUR/USD");
      expect(result.timestamp).to.be.at.least(before);
      expect(result.timestamp).to.be.at.most(Date.now() + 100);
    });
  });

  // ── getPrices ────────────────────────────────────────────────────────────────

  describe("getPrices()", () => {
    it("returns a Map with all requested symbols", async () => {
      const oracle = makeOracle();
      const map = await oracle.getPrices(["EUR/USD", "BRL/USD", "SOL/USD"]);
      expect(map.size).to.equal(3);
      expect(map.has("EUR/USD")).to.be.true;
      expect(map.has("BRL/USD")).to.be.true;
      expect(map.has("SOL/USD")).to.be.true;
    });

    it("returns correct prices for all symbols", async () => {
      const oracle = makeOracle();
      const map = await oracle.getPrices(["EUR/USD", "BRL/USD"]);
      expect(map.get("EUR/USD")!.price).to.equal(MOCK_PRICES["EUR/USD"]);
      expect(map.get("BRL/USD")!.price).to.equal(MOCK_PRICES["BRL/USD"]);
    });

    it("handles empty symbol list", async () => {
      const oracle = makeOracle();
      const map = await oracle.getPrices([]);
      expect(map.size).to.equal(0);
    });
  });

  // ── getMintQuote ─────────────────────────────────────────────────────────────

  describe("getMintQuote()", () => {
    it("mints 1:1 for USD (identity peg)", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getMintQuote(100, "USD/USD");
      // MOCK_PRICES["USD/USD"] is undefined → falls back to 1.0
      expect(quote.fiatAmount).to.equal(100);
      expect(quote.usdEquivalent).to.be.closeTo(100, 0.01);
      expect(quote.tokensToMint).to.equal(100_000_000n); // 100 tokens × 10^6
    });

    it("converts EUR to tokens at EUR/USD rate", async () => {
      const oracle = makeOracle();
      // EUR/USD mock = 1.08 → 100 EUR = 108 USD = 108_000_000 raw tokens
      const quote = await oracle.getMintQuote(100, "EUR/USD");
      expect(quote.fiatAmount).to.equal(100);
      expect(quote.usdEquivalent).to.be.closeTo(108, 0.01);
      expect(quote.tokensToMint).to.equal(108_000_000n);
      expect(quote.price.symbol).to.equal("EUR/USD");
    });

    it("converts BRL to tokens at BRL/USD rate", async () => {
      const oracle = makeOracle();
      // BRL/USD mock = 0.19 → 100 BRL = 19 USD = 19_000_000 raw tokens
      const quote = await oracle.getMintQuote(100, "BRL/USD");
      expect(quote.usdEquivalent).to.be.closeTo(19, 0.01);
      expect(quote.tokensToMint).to.equal(19_000_000n);
    });

    it("respects custom decimals (e.g. 9)", async () => {
      const oracle = new OracleModule(connection, "devnet", 9, true);
      // EUR/USD = 1.08 → 100 EUR = 108.000000000 tokens (9 decimals)
      const quote = await oracle.getMintQuote(100, "EUR/USD");
      expect(quote.tokensToMint).to.equal(108_000_000_000n);
    });

    it("handles fractional fiat amounts", async () => {
      const oracle = makeOracle();
      // 0.5 EUR at 1.08 = 0.54 USD = 540_000 raw tokens
      const quote = await oracle.getMintQuote(0.5, "EUR/USD");
      expect(quote.tokensToMint).to.equal(540_000n);
    });

    it("returns 0 tokens for 0 fiat input", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getMintQuote(0, "EUR/USD");
      expect(quote.tokensToMint).to.equal(0n);
    });

    it("attaches the price result to the quote", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getMintQuote(50, "EUR/USD");
      expect(quote.price).to.deep.include({ symbol: "EUR/USD", source: "mock" });
    });
  });

  // ── getRedeemQuote ───────────────────────────────────────────────────────────

  describe("getRedeemQuote()", () => {
    it("redeems 1:1 for USD", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getRedeemQuote(100_000_000n, "USD/USD");
      expect(quote.usdEquivalent).to.be.closeTo(100, 0.001);
      expect(quote.fiatToReturn).to.be.closeTo(100, 0.001);
    });

    it("converts tokens back to EUR correctly", async () => {
      const oracle = makeOracle();
      // 108_000_000 raw tokens = 108 USD / 1.08 EUR/USD = 100 EUR
      const quote = await oracle.getRedeemQuote(108_000_000n, "EUR/USD");
      expect(quote.usdEquivalent).to.be.closeTo(108, 0.01);
      expect(quote.fiatToReturn).to.be.closeTo(100, 0.01);
    });

    it("converts tokens back to BRL correctly", async () => {
      const oracle = makeOracle();
      // 19_000_000 raw tokens = 19 USD / 0.19 BRL/USD = 100 BRL
      const quote = await oracle.getRedeemQuote(19_000_000n, "BRL/USD");
      expect(quote.fiatToReturn).to.be.closeTo(100, 0.01);
    });

    it("returns 0 fiat for 0 tokens", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getRedeemQuote(0n, "EUR/USD");
      expect(quote.fiatToReturn).to.equal(0);
      expect(quote.usdEquivalent).to.equal(0);
    });

    it("attaches the price result to the redeem quote", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getRedeemQuote(50_000_000n, "BRL/USD");
      expect(quote.price).to.deep.include({ symbol: "BRL/USD", source: "mock" });
    });
  });

  // ── Mint / Redeem round-trip ─────────────────────────────────────────────────

  describe("mint → redeem round-trip", () => {
    it("minting then redeeming returns the original fiat amount (EUR)", async () => {
      const oracle = makeOracle();
      const fiatIn = 250;
      const mintQ = await oracle.getMintQuote(fiatIn, "EUR/USD");
      const redeemQ = await oracle.getRedeemQuote(mintQ.tokensToMint, "EUR/USD");
      expect(redeemQ.fiatToReturn).to.be.closeTo(fiatIn, 0.01);
    });

    it("minting then redeeming returns the original fiat amount (BRL)", async () => {
      const oracle = makeOracle();
      const fiatIn = 1000;
      const mintQ = await oracle.getMintQuote(fiatIn, "BRL/USD");
      const redeemQ = await oracle.getRedeemQuote(mintQ.tokensToMint, "BRL/USD");
      expect(redeemQ.fiatToReturn).to.be.closeTo(fiatIn, 0.1);
    });
  });

  // ── formatMintQuote / formatRedeemQuote ──────────────────────────────────────

  describe("formatMintQuote()", () => {
    it("returns a non-empty string", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getMintQuote(100, "EUR/USD");
      const str = oracle.formatMintQuote(quote);
      expect(str).to.be.a("string").and.not.empty;
    });

    it("contains the fiat amount and symbol", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getMintQuote(100, "EUR/USD");
      const str = oracle.formatMintQuote(quote);
      expect(str).to.include("100.00");
      expect(str).to.include("EUR");
    });

    it("contains the source label", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getMintQuote(100, "EUR/USD");
      const str = oracle.formatMintQuote(quote);
      expect(str).to.include("mock");
    });
  });

  describe("formatRedeemQuote()", () => {
    it("returns a non-empty string", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getRedeemQuote(108_000_000n, "EUR/USD");
      const str = oracle.formatRedeemQuote(quote);
      expect(str).to.be.a("string").and.not.empty;
    });

    it("contains the symbol and redeem amount", async () => {
      const oracle = makeOracle();
      const quote = await oracle.getRedeemQuote(108_000_000n, "EUR/USD");
      const str = oracle.formatRedeemQuote(quote);
      expect(str).to.include("EUR");
      expect(str).to.include("108.000000");
    });
  });

  // ── feeds / config ───────────────────────────────────────────────────────────

  describe("SWITCHBOARD_FEEDS", () => {
    it("has mainnet feeds defined", () => {
      expect(SWITCHBOARD_FEEDS).to.have.property("mainnet");
      expect(SWITCHBOARD_FEEDS.mainnet).to.have.property("EUR/USD");
      expect(SWITCHBOARD_FEEDS.mainnet).to.have.property("BRL/USD");
      expect(SWITCHBOARD_FEEDS.mainnet).to.have.property("SOL/USD");
    });

    it("has devnet feeds defined", () => {
      expect(SWITCHBOARD_FEEDS).to.have.property("devnet");
      expect(SWITCHBOARD_FEEDS.devnet).to.have.property("SOL/USD");
    });

    it("all feed addresses are 32–44 char base58 strings", () => {
      for (const [, feeds] of Object.entries(SWITCHBOARD_FEEDS)) {
        for (const [, addr] of Object.entries(feeds)) {
          expect(addr).to.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
        }
      }
    });
  });

  describe("MOCK_PRICES", () => {
    it("all prices are positive numbers", () => {
      for (const [sym, price] of Object.entries(MOCK_PRICES)) {
        expect(price, sym).to.be.a("number").and.above(0);
      }
    });

    it("USD/USD peg equals 1.0", () => {
      expect(MOCK_PRICES["USD/USD"]).to.equal(1.0);
    });

    it("CPI/USD is above 1.0 (reflects inflation)", () => {
      expect(MOCK_PRICES["CPI/USD"]).to.be.above(1.0);
    });
  });

  // ── ORACLE_MOCK env var ───────────────────────────────────────────────────────

  describe("ORACLE_MOCK environment variable", () => {
    it("forces mock mode when ORACLE_MOCK=true", async () => {
      process.env.ORACLE_MOCK = "true";
      // useMock=false but env var overrides
      const oracle = new OracleModule(connection, "mainnet", 6, false);
      const result = await oracle.getPrice("EUR/USD");
      expect(result.source).to.equal("mock");
      delete process.env.ORACLE_MOCK;
    });
  });
});
