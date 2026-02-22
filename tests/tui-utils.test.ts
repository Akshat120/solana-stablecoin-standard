import { expect } from "chai";
import { fmt, resolveRpcUrl } from "../packages/tui/src/utils";

describe("TUI Utilities", () => {
  // ── fmt() ────────────────────────────────────────────────────────────────────

  describe("fmt()", () => {
    it("formats 1 token (6 decimals) correctly", () => {
      expect(fmt(1_000_000n, 6)).to.equal("1.000000");
    });

    it("formats 0 tokens correctly", () => {
      expect(fmt(0n, 6)).to.equal("0.000000");
    });

    it("formats fractional amounts correctly", () => {
      expect(fmt(500_000n, 6)).to.equal("0.500000");
    });

    it("formats a large supply correctly", () => {
      // 1,000,000.000000 tokens — uses en-US locale so commas are predictable
      expect(fmt(1_000_000_000_000n, 6)).to.equal("1,000,000.000000");
    });

    it("formats 108.5 tokens (EUR example)", () => {
      expect(fmt(108_500_000n, 6)).to.equal("108.500000");
    });

    it("formats minimum non-zero value (1 raw unit)", () => {
      expect(fmt(1n, 6)).to.equal("0.000001");
    });

    it("works with 9 decimals", () => {
      expect(fmt(1_000_000_000n, 9)).to.equal("1.000000000");
    });

    it("works with 0 decimals (whole-unit tokens, trailing dot)", () => {
      expect(fmt(42n, 0)).to.equal("42.");
    });

    it("uses default decimals of 6", () => {
      expect(fmt(1_000_000n)).to.equal("1.000000");
    });

    it("pads fractional part to full decimal width", () => {
      // 0.000100 — must be 6 chars after dot
      const result = fmt(100n, 6);
      const fracPart = result.split(".")[1];
      expect(fracPart).to.have.length(6);
    });

    it("handles very large bigint without overflow", () => {
      // Total supply cap scenario: 100 billion tokens × 10^6
      const huge = 100_000_000_000n * 1_000_000n;
      const result = fmt(huge, 6);
      expect(result).to.equal("100,000,000,000.000000");
    });
  });

  // ── resolveRpcUrl() ──────────────────────────────────────────────────────────

  describe("resolveRpcUrl()", () => {
    it("resolves 'devnet' to the devnet RPC URL", () => {
      expect(resolveRpcUrl("devnet")).to.equal("https://api.devnet.solana.com");
    });

    it("resolves 'mainnet' to the mainnet RPC URL", () => {
      expect(resolveRpcUrl("mainnet")).to.equal("https://api.mainnet-beta.solana.com");
    });

    it("resolves 'testnet' to the testnet RPC URL", () => {
      expect(resolveRpcUrl("testnet")).to.equal("https://api.testnet.solana.com");
    });

    it("resolves 'localhost' to local validator URL", () => {
      expect(resolveRpcUrl("localhost")).to.equal("http://localhost:8899");
    });

    it("resolves 'localnet' to local validator URL", () => {
      expect(resolveRpcUrl("localnet")).to.equal("http://localhost:8899");
    });

    it("passes through unknown values as raw URLs", () => {
      const custom = "https://my-rpc.example.com";
      expect(resolveRpcUrl(custom)).to.equal(custom);
    });

    it("passes through custom localhost ports as raw URLs", () => {
      const custom = "http://localhost:8900";
      expect(resolveRpcUrl(custom)).to.equal(custom);
    });
  });
});
