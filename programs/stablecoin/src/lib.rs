use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Xv1J7SAGmEMGcULWPZPD7X3SVWt1EsT41fKXPq5XcdK");

#[program]
pub mod stablecoin {
    use super::*;

    /// Initialize a new stablecoin with config (SSS-1 or SSS-2)
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    /// Mint tokens to a recipient
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount)
    }

    /// Burn tokens from an account
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
    }

    /// Freeze a token account
    pub fn freeze_account(ctx: Context<FreezeTokenAccount>) -> Result<()> {
        instructions::freeze::freeze_handler(ctx)
    }

    /// Thaw a frozen token account
    pub fn thaw_account(ctx: Context<ThawTokenAccount>) -> Result<()> {
        instructions::freeze::thaw_handler(ctx)
    }

    /// Pause all minting and burning operations
    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause::pause_handler(ctx)
    }

    /// Unpause operations
    pub fn unpause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause::unpause_handler(ctx)
    }

    /// Add or update a minter with optional quota
    pub fn update_minter(ctx: Context<UpdateMinter>, params: UpdateMinterParams) -> Result<()> {
        instructions::roles::update_minter_handler(ctx, params)
    }

    /// Update roles (burner, blacklister, pauser, seizer)
    pub fn update_roles(ctx: Context<UpdateRoles>, params: UpdateRolesParams) -> Result<()> {
        instructions::roles::update_roles_handler(ctx, params)
    }

    /// Transfer master authority to a new account
    pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
        instructions::roles::transfer_authority_handler(ctx)
    }

    // SSS-2 compliance instructions

    /// Add an address to the blacklist (SSS-2 only)
    pub fn add_to_blacklist(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
        instructions::blacklist::add_handler(ctx, reason)
    }

    /// Remove an address from the blacklist (SSS-2 only)
    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
        instructions::blacklist::remove_handler(ctx)
    }

    /// Seize tokens from a blacklisted account via permanent delegate (SSS-2 only)
    pub fn seize(ctx: Context<Seize>, amount: u64) -> Result<()> {
        instructions::seize::handler(ctx, amount)
    }
}
