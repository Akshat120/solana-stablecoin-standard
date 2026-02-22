use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct MinterState {
    /// The minter's address
    pub minter: Pubkey,
    /// The stablecoin state this minter belongs to
    pub stablecoin_state: Pubkey,
    /// Optional quota (0 = unlimited)
    pub quota: u64,
    /// Amount minted so far in this period
    pub minted_this_period: u64,
    /// Whether this minter is active
    pub active: bool,
    /// Bump seed
    pub bump: u8,
}

impl MinterState {
    pub const SEED: &'static [u8] = b"minter";
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;

    pub fn can_mint(&self, amount: u64) -> bool {
        if !self.active {
            return false;
        }
        if self.quota == 0 {
            return true; // unlimited
        }
        self.minted_this_period.checked_add(amount).map_or(false, |sum| sum <= self.quota)
    }
}
