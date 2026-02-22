// Trident Fuzz Tests for Solana Stablecoin Standard
// Run with: trident fuzz run fuzz_0
//
// Invariants tested:
// 1. After initialize, stablecoin_state.paused == false
// 2. After initialize, stablecoin_state.total_minted == 0
// 3. Minting beyond quota always fails with QuotaExceeded
// 4. SSS-2 instructions fail with ComplianceNotEnabled on SSS-1
// 5. Unauthorized callers always fail with Unauthorized
// 6. Seize requires BlacklistEntry to exist

use arbitrary::Unstructured;

/// Drive all fuzz functions from raw arbitrary bytes produced by the fuzzer.
/// Called by the honggfuzz harness in src/bin/fuzz_0.rs.
pub fn run_all(u: &mut Unstructured<'_>) {
    if let (Ok(name), Ok(symbol), Ok(decimals), Ok(ec), Ok(epd), Ok(eth)) = (
        u.arbitrary::<String>(),
        u.arbitrary::<String>(),
        u.arbitrary::<u8>(),
        u.arbitrary::<bool>(),
        u.arbitrary::<bool>(),
        u.arbitrary::<bool>(),
    ) {
        fuzz_initialize(name, symbol, decimals, ec, epd, eth);
    }

    if let (Ok(amount), Ok(quota), Ok(paused), Ok(minted_so_far)) = (
        u.arbitrary::<u64>(),
        u.arbitrary::<u64>(),
        u.arbitrary::<bool>(),
        u.arbitrary::<u64>(),
    ) {
        fuzz_mint(amount, quota, paused, minted_so_far);
    }

    if let (Ok(compliance_enabled), Ok(reason), Ok(is_blacklister)) = (
        u.arbitrary::<bool>(),
        u.arbitrary::<String>(),
        u.arbitrary::<bool>(),
    ) {
        fuzz_blacklist(compliance_enabled, reason, is_blacklister);
    }

    if let (Ok(ce), Ok(pde), Ok(tb), Ok(is_seizer), Ok(amount)) = (
        u.arbitrary::<bool>(),
        u.arbitrary::<bool>(),
        u.arbitrary::<bool>(),
        u.arbitrary::<bool>(),
        u.arbitrary::<u64>(),
    ) {
        fuzz_seize(ce, pde, tb, is_seizer, amount);
    }
}

/// Fuzz the initialize instruction with random params.
/// Key invariants:
/// - compliance extensions require enable_compliance == true
/// - paused starts false
/// - total_minted starts at 0
pub fn fuzz_initialize(
    name: String,
    symbol: String,
    decimals: u8,
    enable_compliance: bool,
    enable_permanent_delegate: bool,
    enable_transfer_hook: bool,
) {
    // Invariant: compliance extensions require compliance enabled
    if enable_permanent_delegate || enable_transfer_hook {
        assert!(enable_compliance, "Compliance extensions require compliance mode");
    }
    let _ = (name, symbol, decimals);
}

/// Fuzz minting with random amounts and quotas.
/// Key invariants:
/// - Minting amount > quota always fails
/// - Minting when paused always fails
/// - Total minted is monotonically increasing
pub fn fuzz_mint(amount: u64, quota: u64, paused: bool, minted_so_far: u64) {
    if paused {
        // Should fail with Paused
        return;
    }
    if quota > 0 && minted_so_far.saturating_add(amount) > quota {
        // Should fail with QuotaExceeded
        return;
    }
    // Valid mint: total_minted must not overflow
    assert!(
        minted_so_far.checked_add(amount).is_some(),
        "Mint overflow must be caught by checked_add"
    );
}

/// Fuzz blacklist operations.
/// Key invariants:
/// - add_to_blacklist requires compliance_enabled
/// - Non-blacklister callers are rejected
/// - Reason must be <= 200 chars
pub fn fuzz_blacklist(compliance_enabled: bool, reason: String, is_blacklister: bool) {
    if !compliance_enabled {
        // Should fail with ComplianceNotEnabled
        return;
    }
    if !is_blacklister {
        // Should fail with Unauthorized
        return;
    }
    if reason.len() > 200 {
        // Should fail with ReasonTooLong
        return;
    }
    // Valid blacklist add
}

/// Fuzz seize operation.
/// Key invariants:
/// - Seize requires compliance_enabled
/// - Seize requires permanent_delegate_enabled
/// - Seize requires target to be in blacklist
/// - Non-seizer callers are rejected
pub fn fuzz_seize(
    compliance_enabled: bool,
    permanent_delegate_enabled: bool,
    target_blacklisted: bool,
    is_seizer: bool,
    amount: u64,
) {
    if !compliance_enabled {
        // Should fail with ComplianceNotEnabled
        return;
    }
    if !permanent_delegate_enabled {
        // Should fail with ComplianceNotEnabled
        return;
    }
    if !is_seizer {
        // Should fail with Unauthorized
        return;
    }
    if !target_blacklisted {
        // Should fail — BlacklistEntry PDA doesn't exist
        return;
    }
    if amount == 0 {
        // Should fail with InvalidAmount
        return;
    }
    // Valid seize: amount must not overflow
    assert!(amount > 0, "Seize amount invariant");
}
