# SSS-2: Compliant Stablecoin Standard

**Version:** 0.1.0
**Status:** Active

## Summary

SSS-2 is the compliance-first stablecoin standard for Solana. It enforces blacklist rules on every transfer via Token-2022's transfer hook extension and enables token seizure via permanent delegate.

**Target use cases:** USDC/USDT-class regulated stablecoins, OFAC-compliant issuers, GENIUS Act compliant payment stablecoins.

## Specification

### Token-2022 Extensions
| Extension | Required |
|-----------|---------|
| MetadataPointer | ✅ Yes |
| PermanentDelegate | ✅ Yes |
| TransferHook | ✅ Yes |
| DefaultAccountState = Frozen | ✅ Recommended |

### Compliance Architecture

**Blacklist (on-chain PDAs)**

Each blacklisted entity has a `BlacklistEntry` PDA:
- Seeds: `["blacklist", stablecoin_state_pubkey, address_pubkey]`
- Account existence = blacklisted
- Closing the account = removed
- Stores: reason, timestamp, added_by

**Transfer Hook**

The `transfer-hook` program is called by Token-2022 on every transfer. It resolves `BlacklistEntry` PDAs for both sender and receiver. If either account exists, the transfer is rejected. Cannot be bypassed — Token-2022 guarantees hook execution.

**Permanent Delegate**

The `StablecoinState` PDA is the permanent delegate. This allows the `seize` instruction to transfer tokens from any account without the owner's signature. Target must be in the blacklist.

**Default Account State = Frozen**

New token accounts are created in frozen state. Must be thawed by the authority after KYC verification before the holder can use them.

### Roles (SSS-2 additions over SSS-1)
| Role | Powers |
|------|--------|
| authority | All operations |
| minter | Mint up to quota |
| burner | Burn from any account |
| pauser | Pause/unpause |
| blacklister | Add/remove blacklist entries |
| seizer | Execute token seizure |

### Instructions
All SSS-1 instructions plus:

| Instruction | Required Role | Notes |
|-------------|--------------|-------|
| add_to_blacklist | blacklister or authority | Creates BlacklistEntry PDA |
| remove_from_blacklist | blacklister or authority | Closes BlacklistEntry PDA |
| seize | seizer or authority | Target must be blacklisted |

SSS-2 instructions return `ComplianceNotEnabled (6000)` if called on a non-SSS-2 stablecoin.

### Initialization Parameters
```toml
name = "Regulated USD"
symbol = "RUSD"
uri = "https://..."
decimals = 6
enable_compliance = true
enable_permanent_delegate = true
enable_transfer_hook = true
default_account_frozen = true
transfer_hook_program_id = "HookxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX"
```

## Setup (Two Programs)

SSS-2 requires two programs: the main stablecoin program and the transfer-hook program.

```bash
# Deploy both programs
anchor deploy --provider.cluster devnet

# After mint creation, initialize the ExtraAccountMetaList
# (This enables the transfer hook for the specific mint)
# This is done automatically by the SDK
```

## SDK Usage

```typescript
import { SolanaStablecoin, Presets } from "@stbr/sss-token";

// Create SSS-2 stablecoin
const compliant = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "Regulated USD",
  symbol: "RUSD",
  decimals: 6,
  authority: adminKeypair,
  transferHookProgramId: hookProgramId,
});

// Set up compliance roles
await compliant.updateRoles(
  {
    blacklister: blacklisterPublicKey,
    seizer: seizerPublicKey,
    pauser: pauserPublicKey,
  },
  adminKeypair
);

// Blacklist an OFAC-matched address
await compliant.compliance.blacklistAdd(
  { address: badActor, reason: "OFAC SDN List match — Entity XYZ" },
  blacklisterKeypair
);

// Any transfer involving badActor now fails automatically at hook level

// Verify blacklist status
const isBlacklisted = await compliant.compliance.isBlacklisted(address);
const entry = await compliant.compliance.getBlacklistEntry(address);
// { address, reason, timestamp, addedBy }

// Seize tokens (permanent delegate)
await compliant.compliance.seize(
  {
    fromAccount: badActorTokenAccount,
    toAccount: treasuryTokenAccount,
    amount: 50_000_000n,
  },
  seizerKeypair
);

// Remove from blacklist
await compliant.compliance.blacklistRemove(address, blacklisterKeypair);

// Audit log (all current blacklist entries)
const log = await compliant.compliance.getAuditLog();
```

## CLI Usage

```bash
# Initialize SSS-2
sss-token init --preset sss-2 --name "Regulated USD" --symbol RUSD \
  --hook-program <TRANSFER_HOOK_PROGRAM_ID>

# Set compliance roles
sss-token update-roles \
  --blacklister <BLACKLISTER_ADDRESS> \
  --seizer <SEIZER_ADDRESS>

# Blacklist operations
sss-token blacklist add <address> --reason "OFAC SDN match"
sss-token blacklist remove <address>
sss-token blacklist check <address>

# Seize
sss-token seize <from-account> --to <treasury-account> --amount 50000000

# Audit
sss-token audit-log
sss-token audit-log --json > audit.json
```

## Regulatory Alignment

SSS-2 is designed to align with:

- **GENIUS Act (2025)** — Blacklisting and seizure capabilities required for payment stablecoin issuers
- **OFAC Compliance** — Transfer hook prevents sanctioned entities from transacting (proactive, not reactive)
- **FinCEN MSB** — Audit trail via on-chain events + compliance service

See [COMPLIANCE.md](COMPLIANCE.md) for detailed regulatory considerations.

## Important Design Decisions

1. **Extensions are immutable** — Set at mint creation. Cannot add compliance to an existing SSS-1 stablecoin.
2. **Blacklist = PDA existence** — The transfer hook checks for PDA existence, not PDA data. This is efficient (no deserialization) and atomic.
3. **Seize requires blacklist** — Cannot seize from a non-blacklisted account. This is an intentional safeguard.
4. **Default frozen** — Recommended for regulated issuers. New accounts must be thawed after KYC verification.
