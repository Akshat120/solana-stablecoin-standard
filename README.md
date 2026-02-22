# Solana Stablecoin Standard (SSS)

> Open-source SDK and standards for production-ready stablecoins on Solana — built by [Superteam Brazil](https://superteam.fun/brazil)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue)](https://www.anchor-lang.com/)
[![Token-2022](https://img.shields.io/badge/Token--2022-enabled-green)](https://spl.solana.com/token-2022)

## Overview

The Solana Stablecoin Standard (SSS) is a modular, production-ready SDK for building stablecoins on Solana. Think OpenZeppelin for stablecoins — the SDK is the library, SSS-1 and SSS-2 are the standards (what gets adopted and referenced).

## Architecture

```
Layer 3 — Standards
  SSS-1: Minimal Stablecoin     SSS-2: Compliant Stablecoin
  (DAO, internal, settlement)   (USDC/USDT-class regulated)
        |                               |
Layer 2 — Modules
  Compliance Module (Transfer Hook + Blacklist PDAs)
  Role Management (Minter quotas, RBAC)
        |
Layer 1 — Base SDK
  Token-2022 Mint | Anchor Program | TypeScript SDK | CLI
```

## Preset Comparison

| Feature                      | SSS-1 | SSS-2 |
|------------------------------|-------|-------|
| Token-2022 Mint              | ✅    | ✅    |
| Metadata (name/symbol/uri)   | ✅    | ✅    |
| Freeze Authority             | ✅    | ✅    |
| Mint/Burn Roles              | ✅    | ✅    |
| Pause/Unpause                | ✅    | ✅    |
| Per-minter Quotas            | ✅    | ✅    |
| Permanent Delegate           | ❌    | ✅    |
| Transfer Hook (Blacklist)    | ❌    | ✅    |
| Default Account Frozen       | ❌    | ✅    |
| On-chain Blacklist           | ❌    | ✅    |
| Token Seizure                | ❌    | ✅    |
| **Use Case**                 | Internal, DAO | Regulated issuer |

## Quick Start

### TypeScript SDK

```bash
npm install @stbr/sss-token
```

```typescript
import { SolanaStablecoin, Presets } from "@stbr/sss-token";

// SSS-1: Minimal stablecoin
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_1,
  name: "My Stablecoin",
  symbol: "MYUSD",
  decimals: 6,
  authority: adminKeypair,
});

// SSS-2: Compliant stablecoin
const compliant = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "Regulated USD",
  symbol: "RUSD",
  decimals: 6,
  authority: adminKeypair,
  transferHookProgramId: hookProgramId,
});

// Operations
await stable.mint({ recipient, amount: 1_000_000n, minter: minterKeypair });
await stable.freeze(tokenAccount, adminKeypair);
const supply = await stable.getTotalSupply();

// SSS-2: Compliance
await compliant.compliance.blacklistAdd(
  { address: badActor, reason: "OFAC SDN match" },
  blacklisterKeypair
);
await compliant.compliance.seize(
  { fromAccount: badActorATA, toAccount: treasuryATA, amount: 1_000_000n },
  seizerKeypair
);
```

### CLI

```bash
npm install -g @stbr/sss-cli

# Initialize
sss-token init --preset sss-1 --name "My USD" --symbol MUSD
sss-token init --preset sss-2 --name "Regulated USD" --symbol RUSD \
  --hook-program <HOOK_PROGRAM_ID>

# Core operations
sss-token mint <recipient> <amount>
sss-token burn <from-account> <amount>
sss-token freeze account <token-account>
sss-token freeze thaw <token-account>
sss-token pause
sss-token unpause
sss-token status
sss-token supply

# SSS-2 compliance
sss-token blacklist add <address> --reason "OFAC match"
sss-token blacklist remove <address>
sss-token blacklist check <address>
sss-token seize <from-account> --to <treasury> --amount <amount>

# Management
sss-token minters add <address> --quota 1000000
sss-token minters remove <address>
sss-token minters info <address>
sss-token update-roles --pauser <address> --burner <address>
sss-token holders [--min-balance <amount>]
sss-token audit-log [--action <type>] [--json]
```

### Backend Services

```bash
cp .env.example .env
# Edit .env with your RPC_URL and program IDs
docker compose up
```

| Service    | Port | Purpose                              |
|------------|------|--------------------------------------|
| mint-service | 3001 | Fiat-to-stablecoin lifecycle        |
| indexer    | 3002 | On-chain event listener & indexer   |
| compliance | 3003 | Sanctions screening & audit (SSS-2) |
| webhook    | 3004 | Configurable event notifications    |

## Deployment

### Build Programs

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Run Tests

```bash
anchor test
```

## Devnet Deployment

| Component          | Program ID                                        |
|--------------------|---------------------------------------------------|
| Stablecoin Program | `STBLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`    |
| Transfer Hook      | `HookxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX`    |

> Update `Anchor.toml` and `.env` with real program IDs after deployment.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layer model, data flows, security |
| [docs/SDK.md](docs/SDK.md) | TypeScript SDK reference |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Operator runbook |
| [docs/SSS-1.md](docs/SSS-1.md) | Minimal stablecoin standard spec |
| [docs/SSS-2.md](docs/SSS-2.md) | Compliant stablecoin standard spec |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) | Regulatory considerations |
| [docs/API.md](docs/API.md) | Backend API reference |

## Project Structure

```
solana-stablecoin-standard/
├── programs/
│   ├── stablecoin/         # Main Anchor program (SSS-1 & SSS-2)
│   └── transfer-hook/      # Transfer hook for SSS-2 blacklist enforcement
├── packages/
│   ├── sdk/                # @stbr/sss-token TypeScript SDK
│   └── cli/                # @stbr/sss-cli CLI tool
├── services/
│   ├── mint-service/       # Mint/burn lifecycle (port 3001)
│   ├── indexer/            # Event listener (port 3002)
│   ├── compliance/         # Sanctions & audit (port 3003)
│   └── webhook/            # Notifications (port 3004)
├── tests/                  # Integration tests
├── docs/                   # Documentation
├── Anchor.toml
├── Cargo.toml
├── docker-compose.yml
└── package.json
```

## License

MIT © Superteam Brazil
