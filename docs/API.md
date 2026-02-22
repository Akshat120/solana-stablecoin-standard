# Backend API Reference

## Service Overview

| Service | Port | Description |
|---------|------|-------------|
| mint-service | 3001 | Fiat-to-stablecoin lifecycle coordination |
| indexer | 3002 | On-chain event listener and state tracker |
| compliance | 3003 | Sanctions screening and audit trail (SSS-2) |
| webhook | 3004 | Configurable event notifications with retry |

All services: `GET /health` returns `{ status: "ok", service: "...", ... }`.

---

## Mint Service (port 3001)

### POST /api/mint
Initiate a mint request (async).

**Request:**
```json
{
  "recipient": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "amount": "1000000",
  "mint": "<mint_address>"
}
```

**Response `202`:**
```json
{ "requestId": "550e8400-e29b-41d4-a716-446655440000", "status": "pending" }
```

### POST /api/burn
Initiate a burn request.

**Request:**
```json
{
  "fromAccount": "<token_account>",
  "amount": "500000",
  "mint": "<mint_address>"
}
```

### GET /api/requests/:id
Get request status.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "mint",
  "status": "completed",
  "txSignature": "5KJZ...",
  "recipient": "<address>",
  "amount": "1000000",
  "mint": "<mint>",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:05.000Z"
}
```

**Status values:** `pending`, `verifying`, `executing`, `completed`, `failed`

### GET /api/requests
List recent requests (last 100).

---

## Indexer (port 3002)

### GET /api/events
Get indexed on-chain events.

**Query params:**
- `type` — Filter by event type (e.g., `TokensMinted`)
- `limit` — Max results (default: 100)

**Response:**
```json
[
  {
    "type": "TokensMinted",
    "slot": 123456789,
    "signature": "5KJZ...",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "raw": "Program log: ..."
  }
]
```

**Event types:** `TokensMinted`, `TokensBurned`, `AccountFrozen`, `AccountThawed`, `AddedToBlacklist`, `RemovedFromBlacklist`, `TokensSeized`, `StablecoinPaused`, `StablecoinUnpaused`, `StablecoinInitialized`, `MinterUpdated`, `RolesUpdated`, `AuthorityTransferred`

### GET /api/events/count
Get event counts by type.

**Response:**
```json
{ "TokensMinted": 42, "TokensBurned": 5, "AddedToBlacklist": 2 }
```

---

## Compliance Service (port 3003)

### POST /api/screen
Screen a Solana address for sanctions.

**Request:**
```json
{ "address": "<solana_address>" }
```

**Response:**
```json
{
  "address": "<address>",
  "sanctioned": false,
  "riskScore": 0,
  "riskLevel": "low",
  "sources": ["OFAC_SDN_MOCK", "CHAINALYSIS_MOCK"],
  "checkedAt": "2024-01-15T10:00:00.000Z"
}
```

**Risk levels:** `low`, `medium`, `high`, `critical`

### POST /api/audit
Log a compliance action.

**Request:**
```json
{
  "action": "blacklist_add",
  "address": "<address>",
  "details": { "reason": "OFAC match", "riskScore": 100 },
  "operator": "compliance-team",
  "txSignature": "5KJZ...",
  "riskScore": 100
}
```

**Action values:** `blacklist_add`, `blacklist_remove`, `seize`, `freeze`, `sanctions_check`

### GET /api/audit
Export audit log.

**Query params:**
- `action` — Filter by action type
- `address` — Filter by address
- `fromDate` — ISO date string
- `toDate` — ISO date string
- `limit` — Max results (default: 100)

**Response:**
```json
{
  "entries": [...],
  "total": 42,
  "exportedAt": "2024-01-15T10:00:00.000Z"
}
```

### GET /api/audit/export.csv
Download audit log as CSV.

**Headers:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename=audit-log.csv
```

### GET /api/risk/:address
Get risk assessment for a specific address.

---

## Webhook Service (port 3004)

### POST /api/endpoints
Register a webhook endpoint.

**Request:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["TokensMinted", "AddedToBlacklist", "*"],
  "secret": "optional_signing_secret"
}
```

Use `"*"` to receive all event types.

**Response `201`:**
```json
{
  "id": "...",
  "url": "https://your-app.com/webhook",
  "events": ["TokensMinted"],
  "active": true,
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

### GET /api/endpoints
List registered endpoints.

### DELETE /api/endpoints/:id
Remove endpoint. Returns `204`.

### POST /api/dispatch
Dispatch an event to matching endpoints. Called internally by the indexer.

**Request:**
```json
{
  "type": "TokensMinted",
  "slot": 123456789,
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Response:**
```json
{ "dispatched": 2, "deliveryIds": ["...", "..."] }
```

### GET /api/deliveries
List webhook delivery attempts.

**Query params:**
- `status` — `pending`, `delivered`, or `failed`
- `limit` — Max results (default: 50)

---

## Webhook Payload Format

All webhooks are sent as `POST` with `Content-Type: application/json`:

```json
{
  "type": "TokensMinted",
  "slot": 123456789,
  "signature": "5KJZ...",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "raw": "Program log: ..."
}
```

**Request headers:**
```
X-SSS-Event:     TokensMinted
X-SSS-Delivery:  <delivery-uuid>
X-SSS-Timestamp: 2024-01-15T10:00:00.000Z
X-SSS-Signature: sha256=<hmac-sha256>
```

Verify the signature with your endpoint secret (HMAC-SHA256 of the request body).

**Retry policy:** Up to 3 attempts with delays of 1s, 5s, 30s.
