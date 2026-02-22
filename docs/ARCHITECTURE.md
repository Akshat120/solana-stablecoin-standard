# Architecture

## Layer Model

The SDK is organized in three layers, following a clean separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                   LAYER 3 — STANDARDS                        │
│                                                               │
│  SSS-1: Minimal Stablecoin     SSS-2: Compliant Stablecoin  │
│  ┌────────────────────┐       ┌────────────────────────┐    │
│  │ Mint authority     │       │ SSS-1 base             │    │
│  │ Freeze authority   │       │ Permanent delegate     │    │
│  │ Token metadata     │       │ Transfer hook          │    │
│  │ Role-based access  │       │ On-chain blacklist     │    │
│  │ Per-minter quotas  │       │ Default frozen state   │    │
│  │ Pause/unpause      │       │ Token seizure          │    │
│  └────────────────────┘       └────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   LAYER 2 — MODULES                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Compliance Module                                    │    │
│  │  • BlacklistEntry PDAs — one per blacklisted address│    │
│  │  • Transfer hook validates sender/receiver PDAs     │    │
│  │  • Permanent delegate enables seize instruction     │    │
│  │  • Audit trail via on-chain events                  │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Role Management                                      │    │
│  │  • Master authority (full control)                  │    │
│  │  • Minter (per-minter quotas)                       │    │
│  │  • Burner                                           │    │
│  │  • Pauser                                           │    │
│  │  • Blacklister (SSS-2)                              │    │
│  │  • Seizer (SSS-2)                                   │    │
│  │  • 2-step authority transfer                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   LAYER 1 — BASE SDK                         │
│                                                               │
│  Token-2022 Mint  │  Anchor Program  │  TypeScript SDK       │
│  CLI tool         │  Backend Services│  Docker               │
└─────────────────────────────────────────────────────────────┘
```

## Token-2022 Extensions

### SSS-1
| Extension | Purpose |
|-----------|---------|
| MetadataPointer | On-chain name, symbol, URI |

### SSS-2 (all SSS-1 extensions plus)
| Extension | Purpose |
|-----------|---------|
| PermanentDelegate | Enables seize without owner signature |
| TransferHook | Blacklist enforcement on every transfer |
| DefaultAccountState = Frozen | New accounts frozen until KYC |

**Important:** Extensions are set at mint creation and cannot be added or removed afterward.

## Data Flow

### SSS-1 Mint Flow
```
User → CLI/SDK
     → mint_tokens instruction
     → Stablecoin Program (checks: not paused, minter active, quota ok)
     → CPI to Token-2022
     → MintTo recipient ATA
     → Emit TokensMinted event
```

### SSS-2 Transfer Flow (every transfer)
```
User → Transfer → Token-2022 Program
               → TransferHook extension triggers
               → transfer-hook Program
               → Resolve sender BlacklistEntry PDA
               → Resolve receiver BlacklistEntry PDA
               → Account exists? REJECT (Blacklisted error)
               → Account absent? ALLOW transfer
```

### SSS-2 Seize Flow
```
Seizer → seize instruction → Stablecoin Program
                           → Assert compliance_enabled
                           → Assert permanent_delegate_enabled
                           → Assert seizer role
                           → Assert BlacklistEntry PDA exists for target
                           → CPI to Token-2022 (using PDA as perm delegate)
                           → Transfer tokens to treasury
                           → Emit TokensSeized event
```

## Account Structure

### StablecoinState PDA
**Seeds:** `["stablecoin_state", mint_pubkey]`

The central state account. Acts as:
- Mint authority
- Freeze authority
- Permanent delegate (SSS-2)

Stores all configuration, roles, and lifetime metrics.

### MinterState PDA
**Seeds:** `["minter", stablecoin_state_pubkey, minter_pubkey]`

Tracks per-minter quota and minted_this_period. One PDA per authorized minter.

### BlacklistEntry PDA
**Seeds:** `["blacklist", stablecoin_state_pubkey, address_pubkey]`

Existence = blacklisted. Closing the account (via `remove_from_blacklist`) = removed. The transfer hook checks for PDA existence — no data needs to be read.

### ExtraAccountMetaList PDA (Transfer Hook)
**Seeds:** `["extra-account-metas", mint_pubkey]`

Defines the extra accounts the transfer hook program receives per transfer call. Must be initialized after mint creation.

## Programs

### stablecoin (main program)

Single configurable program supporting both presets. Initialization parameters determine which compliance features are enabled. SSS-2 instructions (`add_to_blacklist`, `remove_from_blacklist`, `seize`) return `ComplianceNotEnabled` if called on a non-SSS-2 stablecoin.

### transfer-hook

Separate program called by Token-2022's TransferHook extension on every transfer. Stateless check: resolves PDAs for sender/receiver and rejects if either account exists.

Cannot be bypassed — Token-2022 guarantees hook execution on every transfer.

## Backend Services

```
Solana Validator
      │
      │ (onLogs subscription)
      ▼
┌─────────────┐    events    ┌──────────────┐
│   indexer   │ ──────────► │   webhook    │
│  port 3002  │             │  port 3004   │
└─────────────┘             └──────────────┘
                                    │
                             (HTTP POST to
                              registered URLs)

┌──────────────┐             ┌──────────────┐
│ mint-service │             │  compliance  │
│  port 3001   │             │  port 3003   │
└──────────────┘             └──────────────┘
```

## Security Model

1. **No single key controls everything** — roles are separated by principle of least privilege
2. **2-step authority transfer** — `pending_authority` must accept before transfer completes
3. **SSS-2 gating** — compliance instructions fail gracefully (`ComplianceNotEnabled`) if not enabled at init
4. **Immutable compliance** — permanent delegate and transfer hook set at mint creation via Token-2022 extensions; cannot be changed post-hoc
5. **PDA-based authority** — program PDA acts as mint/freeze/delegate authority, not a keypair
6. **Overflow checks** — `overflow-checks = true` in Rust release profile
7. **Blacklist for seize** — seize instruction requires target to be in the blacklist (account must exist)
