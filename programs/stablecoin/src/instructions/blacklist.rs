use anchor_lang::prelude::*;
use crate::{error::StablecoinError, state::*};

#[derive(Accounts)]
#[instruction(reason: String)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [StablecoinState::SEED, stablecoin_state.mint.as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.compliance_enabled @ StablecoinError::ComplianceNotEnabled,
        constraint = stablecoin_state.is_blacklister(&blacklister.key()) @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    /// CHECK: The address to blacklist
    pub address: UncheckedAccount<'info>,

    #[account(
        init,
        payer = blacklister,
        space = BlacklistEntry::space(&reason),
        seeds = [BlacklistEntry::SEED, stablecoin_state.key().as_ref(), address.key().as_ref()],
        bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [StablecoinState::SEED, stablecoin_state.mint.as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.compliance_enabled @ StablecoinError::ComplianceNotEnabled,
        constraint = stablecoin_state.is_blacklister(&blacklister.key()) @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    /// CHECK: The address to remove from blacklist
    pub address: UncheckedAccount<'info>,

    #[account(
        mut,
        close = blacklister,
        seeds = [BlacklistEntry::SEED, stablecoin_state.key().as_ref(), address.key().as_ref()],
        bump = blacklist_entry.bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn add_handler(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
    require!(reason.len() <= 200, StablecoinError::ReasonTooLong);

    let entry = &mut ctx.accounts.blacklist_entry;
    entry.address = ctx.accounts.address.key();
    entry.reason = reason.clone();
    entry.timestamp = Clock::get()?.unix_timestamp;
    entry.added_by = ctx.accounts.blacklister.key();
    entry.bump = ctx.bumps.blacklist_entry;

    emit!(AddedToBlacklist {
        mint: ctx.accounts.stablecoin_state.mint,
        address: ctx.accounts.address.key(),
        reason,
        by: ctx.accounts.blacklister.key(),
    });

    Ok(())
}

pub fn remove_handler(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
    emit!(RemovedFromBlacklist {
        mint: ctx.accounts.stablecoin_state.mint,
        address: ctx.accounts.address.key(),
        by: ctx.accounts.blacklister.key(),
    });

    Ok(())
}

#[event]
pub struct AddedToBlacklist {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub reason: String,
    pub by: Pubkey,
}

#[event]
pub struct RemovedFromBlacklist {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub by: Pubkey,
}
