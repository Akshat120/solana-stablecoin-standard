# SSS-1: Minimal Stablecoin Standard

**Version:** 0.1.0
**Status:** Active

## Summary

SSS-1 defines the minimum viable stablecoin for Solana. It provides token issuance, supply management, and emergency controls without compliance overhead.

**Target use cases:** Internal tokens, DAO treasuries, ecosystem settlement, cross-protocol accounting.

## Specification

### Token-2022 Extensions
| Extension | Required |
|-----------|---------|
| MetadataPointer | ✅ Yes |
| PermanentDelegate | ❌ No |
| TransferHook | ❌ No |
| DefaultAccountState | ❌ No |

### Authority Model
The `StablecoinState` PDA holds both mint authority and freeze authority. All privileged operations require a role check.

### Freeze Behavior
Compliance is reactive. Issuers freeze individual token accounts after detecting suspicious activity. There is no automatic enforcement — transactions involving frozen accounts will fail at the Token-2022 level.

### Roles
| Role | Powers |
|------|--------|
| authority | All operations |
| minter | Mint up to assigned quota |
| burner | Burn from any account |
| pauser | Pause/unpause operations |

### Instructions
| Instruction | Required Role |
|-------------|--------------|
| initialize | authority (signer) |
| mint_tokens | minter |
| burn_tokens | burner or authority |
| freeze_account | authority |
| thaw_account | authority |
| pause | authority or pauser |
| unpause | authority or pauser |
| update_minter | authority |
| update_roles | authority |
| transfer_authority | pending_authority (accept step) |

### Initialization Parameters
```toml
name = "My Stablecoin"      # max 32 chars
symbol = "MYUSD"            # max 10 chars
uri = "https://..."         # max 200 chars, optional
decimals = 6
enable_compliance = false
enable_permanent_delegate = false
enable_transfer_hook = false
default_account_frozen = false
```

## SDK Usage

```typescript
import { SolanaStablecoin, Presets } from "@stbr/sss-token";

// Create SSS-1 stablecoin
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_1,
  name: "My Stablecoin",
  symbol: "MYUSD",
  decimals: 6,
  authority: adminKeypair,
});

// Add a minter with 1M token quota
await stable.updateMinter(
  { minter: minterPublicKey, quota: 1_000_000n, active: true },
  adminKeypair
);

// Mint
await stable.mint({
  recipient: recipientPublicKey,
  amount: 100_000n,
  minter: minterKeypair,
});

// Reactive compliance: freeze a suspicious account
await stable.freeze(suspiciousTokenAccount, adminKeypair);

// Check status
const status = await stable.getStatus();
console.log(status.supply, status.paused);
```

## CLI Usage

```bash
# Initialize
sss-token init --preset sss-1 --name "My Stablecoin" --symbol MYUSD

# Minter management
sss-token minters add <address> --quota 1000000
sss-token minters info <address>
sss-token minters remove <address>

# Operations
sss-token mint <recipient> 100000
sss-token burn <from-account> 50000
sss-token freeze account <token-account>
sss-token freeze thaw <token-account>
sss-token pause
sss-token unpause
sss-token status
```

## What SSS-1 Is NOT

SSS-1 does **not** provide:
- Automatic transfer blocking (no transfer hook)
- Token seizure without owner's cooperation (no permanent delegate)
- Proactive compliance enforcement

For regulated stablecoins requiring these features, use **SSS-2**.

## Upgrade Path

A SSS-1 stablecoin cannot be upgraded to SSS-2 in place. Token-2022 extensions are set at mint creation. If compliance features are needed, deploy a new SSS-2 stablecoin and migrate supply.
