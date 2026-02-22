# TypeScript SDK Reference

## Installation

```bash
npm install @stbr/sss-token
# or
yarn add @stbr/sss-token
```

**Peer dependencies:**
```bash
npm install @coral-xyz/anchor @solana/spl-token @solana/web3.js
```

## SolanaStablecoin

### `SolanaStablecoin.create(connection, config)`

Create a new stablecoin.

```typescript
// Preset mode — SSS-1
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_1,
  name: "My Stablecoin",
  symbol: "MYUSD",
  decimals: 6,
  uri: "https://example.com/metadata.json",  // optional
  authority: adminKeypair,
  programId: new PublicKey("..."),  // optional, uses default
});

// Preset mode — SSS-2
const compliant = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "Regulated USD",
  symbol: "RUSD",
  decimals: 6,
  authority: adminKeypair,
  transferHookProgramId: hookProgramId,
});

// Custom config (no preset)
const custom = await SolanaStablecoin.create(connection, {
  name: "Custom Stable",
  symbol: "CUSD",
  decimals: 6,
  enableCompliance: true,
  enablePermanentDelegate: true,
  enableTransferHook: false,
  authority: adminKeypair,
});
```

### `SolanaStablecoin.load(connection, mint, authority, programId?)`

Load an existing stablecoin by mint address.

```typescript
const stable = await SolanaStablecoin.load(
  connection,
  mintPublicKey,
  operatorKeypair,
  programId  // optional
);
```

### `stable.mint(options)`

Mint tokens to a recipient.

```typescript
const tx = await stable.mint({
  recipient: recipientPublicKey,
  amount: 1_000_000n,
  minter: minterKeypair,
});
```

### `stable.burn(options, burner)`

Burn tokens from an account.

```typescript
const tx = await stable.burn(
  { fromAccount: tokenAccount, amount: 500_000n },
  burnerKeypair
);
```

### `stable.freeze(tokenAccount, authority)` / `stable.thaw(...)`

```typescript
await stable.freeze(tokenAccount, authorityKeypair);
await stable.thaw(tokenAccount, authorityKeypair);
```

### `stable.pause(pauser)` / `stable.unpause(pauser)`

```typescript
await stable.pause(pauserKeypair);
await stable.unpause(pauserKeypair);
```

### `stable.updateMinter(options, authority)`

Add or update a minter.

```typescript
await stable.updateMinter(
  {
    minter: minterPublicKey,
    quota: 10_000_000n,  // 0n = unlimited
    active: true,
  },
  authorityKeypair
);
```

### `stable.updateRoles(options, authority)`

```typescript
await stable.updateRoles(
  {
    pauser: pauserPublicKey,
    burner: burnerPublicKey,
    blacklister: blacklisterPublicKey,  // SSS-2 only
    seizer: seizerPublicKey,            // SSS-2 only
  },
  authorityKeypair
);
```

### `stable.getStatus()`

Returns current stablecoin state.

```typescript
const status = await stable.getStatus();
// {
//   mint: string,
//   name: string,
//   symbol: string,
//   decimals: number,
//   paused: boolean,
//   complianceEnabled: boolean,
//   totalMinted: bigint,
//   totalBurned: bigint,
//   supply: bigint,
//   authority: string
// }
```

### `stable.getTotalSupply()`

```typescript
const supply = await stable.getTotalSupply(); // bigint
```

### `stable.getMinterInfo(minter)`

```typescript
const info = await stable.getMinterInfo(minterPublicKey);
// { minter, quota, mintedThisPeriod, active } | null
```

## ComplianceModule (SSS-2)

Accessed via `stable.compliance`.

### `compliance.blacklistAdd(options, blacklister)`

```typescript
await stable.compliance.blacklistAdd(
  { address: badActorPublicKey, reason: "OFAC SDN match" },
  blacklisterKeypair
);
```

### `compliance.blacklistRemove(address, blacklister)`

```typescript
await stable.compliance.blacklistRemove(badActorPublicKey, blacklisterKeypair);
```

### `compliance.isBlacklisted(address)`

```typescript
const blacklisted = await stable.compliance.isBlacklisted(address); // boolean
```

### `compliance.getBlacklistEntry(address)`

```typescript
const entry = await stable.compliance.getBlacklistEntry(address);
// { address, reason, timestamp, addedBy } | null
```

### `compliance.seize(options, seizer)`

```typescript
await stable.compliance.seize(
  {
    fromAccount: frozenTokenAccount,
    toAccount: treasuryTokenAccount,
    amount: 1_000_000n,
  },
  seizerKeypair
);
```

### `compliance.getAuditLog()`

Returns all active blacklist entries for this stablecoin.

```typescript
const log = await stable.compliance.getAuditLog();
// Array<{ address, reason, timestamp, addedBy, pda }>
```

## Presets

```typescript
import { Presets, Preset, getPresetConfig, mergeWithPreset } from "@stbr/sss-token";

Presets.SSS_1  // Preset.SSS_1
Presets.SSS_2  // Preset.SSS_2

// Get default config for a preset
const config = getPresetConfig(Preset.SSS_2);
// { decimals: 6, enableCompliance: true, enablePermanentDelegate: true, ... }

// Merge user config with preset defaults (user config takes precedence)
const merged = mergeWithPreset(Preset.SSS_2, { decimals: 8 });
```

## PDA Utilities

```typescript
import {
  findStablecoinStatePDA,
  findMinterStatePDA,
  findBlacklistEntryPDA,
  findExtraAccountMetaListPDA,
} from "@stbr/sss-token";

const [statePDA, bump] = findStablecoinStatePDA(mintPubkey, programId);
const [minterPDA] = findMinterStatePDA(statePDA, minterPubkey, programId);
const [blacklistPDA] = findBlacklistEntryPDA(statePDA, addressPubkey, programId);
const [metaListPDA] = findExtraAccountMetaListPDA(mintPubkey, hookProgramId);
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | ComplianceNotEnabled | Operation requires SSS-2 |
| 6001 | Paused | Stablecoin is paused |
| 6002 | Unauthorized | Missing required role |
| 6003 | QuotaExceeded | Minter quota exceeded |
| 6004 | Blacklisted | Account is blacklisted |
| 6005 | NotBlacklisted | Account is not blacklisted |
| 6006 | InvalidAmount | Amount must be > 0 |
| 6007 | NameTooLong | Max 32 chars |
| 6008 | SymbolTooLong | Max 10 chars |
| 6009 | UriTooLong | Max 200 chars |
| 6010 | ReasonTooLong | Max 200 chars |
