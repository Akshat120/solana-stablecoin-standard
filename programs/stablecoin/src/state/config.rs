use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct StablecoinState {
    /// Master authority - can do everything
    pub authority: Pubkey,
    /// Pending authority for 2-step transfer
    pub pending_authority: Option<Pubkey>,
    /// The mint account
    pub mint: Pubkey,
    /// Token name
    pub name: String,
    /// Token symbol  
    pub symbol: String,
    /// Token metadata URI
    pub uri: String,
    /// Decimals
    pub decimals: u8,
    /// Whether SSS-2 compliance mode is enabled
    pub compliance_enabled: bool,
    /// Whether permanent delegate is enabled (SSS-2)
    pub permanent_delegate_enabled: bool,
    /// Whether transfer hook is enabled (SSS-2)
    pub transfer_hook_enabled: bool,
    /// Whether new accounts are frozen by default (SSS-2)
    pub default_account_frozen: bool,
    /// Whether minting/burning is paused
    pub paused: bool,
    /// Pauser role
    pub pauser: Option<Pubkey>,
    /// Burner role
    pub burner: Option<Pubkey>,
    /// Blacklister role (SSS-2)
    pub blacklister: Option<Pubkey>,
    /// Seizer role (SSS-2)
    pub seizer: Option<Pubkey>,
    /// Total minted (for tracking)
    pub total_minted: u64,
    /// Total burned
    pub total_burned: u64,
    /// Bump seed
    pub bump: u8,
}

impl StablecoinState {
    pub const SEED: &'static [u8] = b"stablecoin_state";

    pub fn space(name: &str, symbol: &str, uri: &str) -> usize {
        8 + // discriminator
        32 + // authority
        1 + 32 + // pending_authority (Option<Pubkey>)
        32 + // mint
        4 + name.len() + // name String
        4 + symbol.len() + // symbol String
        4 + uri.len() + // uri String
        1 + // decimals
        1 + // compliance_enabled
        1 + // permanent_delegate_enabled
        1 + // transfer_hook_enabled
        1 + // default_account_frozen
        1 + // paused
        1 + 32 + // pauser Option<Pubkey>
        1 + 32 + // burner Option<Pubkey>
        1 + 32 + // blacklister Option<Pubkey>
        1 + 32 + // seizer Option<Pubkey>
        8 + // total_minted
        8 + // total_burned
        1 // bump
    }

    pub fn is_pauser(&self, key: &Pubkey) -> bool {
        self.authority == *key || self.pauser.as_ref() == Some(key)
    }

    pub fn is_blacklister(&self, key: &Pubkey) -> bool {
        self.authority == *key || self.blacklister.as_ref() == Some(key)
    }

    pub fn is_seizer(&self, key: &Pubkey) -> bool {
        self.authority == *key || self.seizer.as_ref() == Some(key)
    }

    pub fn is_burner(&self, key: &Pubkey) -> bool {
        self.authority == *key || self.burner.as_ref() == Some(key)
    }
}

#[account]
#[derive(Debug)]
pub struct BlacklistEntry {
    /// The blacklisted address
    pub address: Pubkey,
    /// Reason for blacklisting
    pub reason: String,
    /// Timestamp
    pub timestamp: i64,
    /// Who added this entry
    pub added_by: Pubkey,
    /// Bump seed
    pub bump: u8,
}

impl BlacklistEntry {
    pub const SEED: &'static [u8] = b"blacklist";

    pub fn space(reason: &str) -> usize {
        8 + 32 + 4 + reason.len() + 8 + 32 + 1
    }
}
