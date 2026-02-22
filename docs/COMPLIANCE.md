# Compliance Considerations

## Regulatory Context

SSS-2 is designed to align with current and emerging stablecoin regulations. This document covers the key compliance features and their regulatory basis.

## GENIUS Act (2025)

The GENIUS Act (Guiding and Establishing National Innovation for US Stablecoins) requires payment stablecoin issuers to:

| Requirement | SSS Implementation |
|-------------|-------------------|
| 1:1 reserve backing | Off-chain (reserve management is outside the token layer) |
| AML/CFT controls | SSS-2 blacklist + transfer hook enforcement |
| Freeze capability | `freeze_account` instruction |
| Seizure capability | `seize` instruction via permanent delegate |
| Redemption at par | `burn` instruction |
| Issuer transparency | On-chain events + audit service |

## OFAC Compliance

SSS-2's transfer hook provides **proactive** compliance enforcement:

- Blacklisted addresses cannot send or receive tokens
- Enforcement is at the protocol level — cannot be bypassed via smart contracts
- Token-2022 guarantees the hook runs on every transfer

This differs from "soft block" approaches where the issuer must react after the fact.

**Sanctions Screening Integration:**

The compliance service provides integration points for:
- OFAC SDN List screening
- Chainalysis KYT (Know Your Transaction)
- Elliptic API
- TRM Labs

```typescript
// Example: Screen and blacklist on sanctions match
const response = await complianceApi.screen(address);
if (response.sanctioned || response.riskScore > 75) {
  await stable.compliance.blacklistAdd(
    {
      address,
      reason: `OFAC match: score=${response.riskScore}, sources=${response.sources.join(",")}`,
    },
    blacklisterKeypair
  );
  await auditApi.log({
    action: "blacklist_add",
    address,
    details: response,
    operator: "compliance-team",
  });
}
```

## FinCEN MSB Requirements

For Money Services Businesses:

1. **Transaction monitoring** — The indexer service tracks all on-chain events
2. **Audit trail** — All compliance actions are logged with timestamp, operator, and reason
3. **SAR filing** — Operators can export audit logs for Suspicious Activity Report filing
4. **KYC/AML procedures** — Integration point exists in compliance service (implement per jurisdiction)

## Audit Trail

### On-Chain Events (immutable)

All program operations emit Anchor events stored permanently on-chain:

| Event | Trigger |
|-------|---------|
| StablecoinInitialized | Mint creation |
| TokensMinted | Every mint |
| TokensBurned | Every burn |
| AccountFrozen / AccountThawed | Freeze/thaw actions |
| AddedToBlacklist | Blacklist add |
| RemovedFromBlacklist | Blacklist remove |
| TokensSeized | Token seizure |
| StablecoinPaused / Unpaused | Pause state changes |
| MinterUpdated | Minter management |
| AuthorityTransferred | Admin changes |

### Off-Chain Audit Log Format

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "action": "blacklist_add",
  "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "details": {
    "reason": "OFAC SDN List match",
    "riskScore": 100,
    "sources": ["OFAC_SDN"]
  },
  "operator": "compliance-officer",
  "txSignature": "5KJZ3b8Yw..."
}
```

Export formats: JSON, CSV (via compliance service API).

## Role Separation for Compliance

SSS-2 enforces strict role separation:

| Action | Minimum Role |
|--------|-------------|
| Mint | minter |
| Burn | burner |
| Freeze/Thaw | authority |
| Pause/Unpause | pauser |
| Blacklist Add/Remove | blacklister |
| Seize | seizer |
| All admin | authority |

**Production recommendation:**
- `authority` → Multisig (Squads Protocol, 3-of-5 or higher)
- `blacklister` → Compliance team multisig or automated pipeline with human approval
- `seizer` → Legal/compliance multisig, higher threshold
- `pauser` → Operations team, lower threshold (emergency)

## Limitations

1. **Privacy** — All blacklist entries and on-chain events are publicly visible. There is no privacy layer in SSS-1 or SSS-2. (SSS-3 with confidential transfers is a future research direction.)

2. **Transfer hook compute** — Each transfer incurs additional compute units for the hook. Test for your use case.

3. **Immutable extensions** — Token-2022 extensions cannot be added after mint creation. SSS-1 cannot be upgraded to SSS-2.

4. **Reserve verification** — SSS does not verify 1:1 backing on-chain. This is the issuer's responsibility.

5. **Jurisdiction** — SSS-2 provides technical tools for compliance. Legal compliance depends on jurisdiction-specific requirements and issuer procedures.

## SSS-3 (Experimental — Private Stablecoin)

A proof-of-concept SSS-3 using Token-2022 confidential transfers is documented as a research direction. The tooling (ZK proof generation, client-side encryption) is still maturing on Solana. Not recommended for production at this time.
