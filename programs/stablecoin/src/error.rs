use anchor_lang::prelude::*;

#[error_code]
pub enum StablecoinError {
    #[msg("Operation requires SSS-2 compliance mode")]
    ComplianceNotEnabled,
    #[msg("Stablecoin is currently paused")]
    Paused,
    #[msg("Unauthorized: missing required role")]
    Unauthorized,
    #[msg("Minter quota exceeded")]
    QuotaExceeded,
    #[msg("Account is blacklisted")]
    Blacklisted,
    #[msg("Account is not blacklisted")]
    NotBlacklisted,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Name too long (max 32 chars)")]
    NameTooLong,
    #[msg("Symbol too long (max 10 chars)")]
    SymbolTooLong,
    #[msg("URI too long (max 200 chars)")]
    UriTooLong,
    #[msg("Reason too long (max 200 chars)")]
    ReasonTooLong,
    #[msg("Cannot remove authority - set a new one first")]
    AuthorityRequired,
    #[msg("Minter already exists")]
    MinterAlreadyExists,
    #[msg("Minter not found")]
    MinterNotFound,
    #[msg("Max minters reached (32)")]
    MaxMintersReached,
    #[msg("Transfer hook not initialized")]
    TransferHookNotInitialized,
}
