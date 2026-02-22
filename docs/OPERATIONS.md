# Operator Runbook

## Initial Setup

### 1. Deploy Programs

```bash
# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Note program IDs from output
export STABLECOIN_PROGRAM_ID=<your_stablecoin_program_id>
export TRANSFER_HOOK_PROGRAM_ID=<your_transfer_hook_program_id>
```

### 2. Initialize Stablecoin

**SSS-1 (Minimal):**
```bash
sss-token init --preset sss-1 \
  --name "My USD" \
  --symbol MUSD \
  --decimals 6 \
  --cluster devnet
```

**SSS-2 (Compliant):**
```bash
sss-token init --preset sss-2 \
  --name "Regulated USD" \
  --symbol RUSD \
  --decimals 6 \
  --hook-program $TRANSFER_HOOK_PROGRAM_ID \
  --cluster devnet
```

**Custom config from TOML:**
```bash
sss-token init --custom config.json
```

Example `config.json`:
```json
{
  "name": "Custom Stable",
  "symbol": "CUSD",
  "decimals": 6,
  "enableCompliance": true,
  "enablePermanentDelegate": true,
  "enableTransferHook": false
}
```

### 3. Set Up Roles (Principle of Least Privilege)

```bash
# Add minters
sss-token minters add <MINTER_ADDRESS> --quota 10000000

# Set operational roles
sss-token update-roles \
  --pauser <PAUSER_ADDRESS> \
  --burner <BURNER_ADDRESS>

# SSS-2: Set compliance roles
sss-token update-roles \
  --blacklister <BLACKLISTER_ADDRESS> \
  --seizer <SEIZER_ADDRESS>
```

**Production:** Each role should be a multisig (e.g., Squads Protocol) or HSM-backed key.

### 4. Start Backend Services

```bash
cp .env.example .env
# Edit .env:
# - RPC_URL
# - STABLECOIN_PROGRAM_ID
# - TRANSFER_HOOK_PROGRAM_ID

docker compose up -d
```

---

## Daily Operations

### Mint (Fiat → Stablecoin)

**Direct CLI:**
```bash
sss-token mint <RECIPIENT_ADDRESS> <AMOUNT>
```

**Via API (recommended for production):**
```bash
# Submit request
curl -X POST http://localhost:3001/api/mint \
  -H "Content-Type: application/json" \
  -d '{"recipient": "<address>", "amount": "1000000", "mint": "<mint>"}'
# Returns: { "requestId": "...", "status": "pending" }

# Poll status
curl http://localhost:3001/api/requests/<requestId>
```

### Burn (Stablecoin → Fiat)

```bash
sss-token burn <TOKEN_ACCOUNT> <AMOUNT>
```

### Freeze / Thaw

```bash
# Freeze a suspicious account (SSS-1 reactive compliance)
sss-token freeze account <TOKEN_ACCOUNT>

# Restore access after resolution
sss-token freeze thaw <TOKEN_ACCOUNT>
```

### Emergency Pause

```bash
# Pause all operations immediately
sss-token pause --keypair ~/.config/solana/pauser.json

# Resume
sss-token unpause --keypair ~/.config/solana/pauser.json
```

### Status Check

```bash
sss-token status
sss-token supply
```

---

## SSS-2 Compliance Operations

### Sanctions Match → Blacklist

```bash
# 1. Screen the address
curl -X POST http://localhost:3003/api/screen \
  -H "Content-Type: application/json" \
  -d '{"address": "<solana_address>"}'

# 2. If sanctioned, blacklist
sss-token blacklist add <ADDRESS> \
  --reason "OFAC SDN List match - Entity: XYZ Corp" \
  --keypair ~/.config/solana/blacklister.json

# 3. Log to compliance service
curl -X POST http://localhost:3003/api/audit \
  -H "Content-Type: application/json" \
  -d '{
    "action": "blacklist_add",
    "address": "<address>",
    "details": {"reason": "OFAC match"},
    "operator": "compliance-team"
  }'
```

### Remove from Blacklist

```bash
sss-token blacklist remove <ADDRESS> \
  --keypair ~/.config/solana/blacklister.json
```

### Check Blacklist Status

```bash
sss-token blacklist check <ADDRESS>
```

### Seize Tokens

**Prerequisites:**
1. Address must be in the blacklist
2. Seizer role must be assigned

```bash
sss-token seize <FROZEN_TOKEN_ACCOUNT> \
  --to <TREASURY_TOKEN_ACCOUNT> \
  --amount <AMOUNT> \
  --keypair ~/.config/solana/seizer.json
```

### Audit Log Export

```bash
# Terminal display
sss-token audit-log

# JSON export
sss-token audit-log --json > audit-$(date +%Y%m%d).json

# Via API - with filters
curl "http://localhost:3003/api/audit?action=blacklist_add&fromDate=2024-01-01" > audit.json

# CSV export
curl http://localhost:3003/api/audit/export.csv > audit.csv
```

---

## Monitoring

### Event Stream

```bash
# All events
curl http://localhost:3002/api/events

# Filter by type
curl "http://localhost:3002/api/events?type=TokensMinted&limit=50"

# Event counts
curl http://localhost:3002/api/events/count
```

### Service Health

```bash
curl http://localhost:3001/health  # mint-service
curl http://localhost:3002/health  # indexer
curl http://localhost:3003/health  # compliance
curl http://localhost:3004/health  # webhook
```

---

## Webhook Notifications

```bash
# Register endpoint
curl -X POST http://localhost:3004/api/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["TokensMinted", "AddedToBlacklist", "TokensSeized"],
    "secret": "your_signing_secret"
  }'

# List endpoints
curl http://localhost:3004/api/endpoints

# Check failed deliveries
curl "http://localhost:3004/api/deliveries?status=failed"
```

---

## Authority Transfer (2-Step)

```bash
# Step 1: Current authority sets pending_authority (via SDK)
# (Call set_pending_authority instruction)

# Step 2: New authority accepts
sss-token transfer-authority \
  --keypair ~/.config/solana/new_authority.json
```

---

## Holder Management

```bash
# List all holders
sss-token holders

# Filter by minimum balance
sss-token holders --min-balance 1000000
```
