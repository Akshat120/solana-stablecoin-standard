use anchor_lang::prelude::*;
use crate::{error::StablecoinError, state::*};

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(mut)]
    pub pauser: Signer<'info>,

    #[account(
        mut,
        seeds = [StablecoinState::SEED, stablecoin_state.mint.as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.is_pauser(&pauser.key()) @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,
}

pub fn pause_handler(ctx: Context<Pause>) -> Result<()> {
    ctx.accounts.stablecoin_state.paused = true;

    emit!(StablecoinPaused {
        mint: ctx.accounts.stablecoin_state.mint,
        by: ctx.accounts.pauser.key(),
    });

    Ok(())
}

pub fn unpause_handler(ctx: Context<Pause>) -> Result<()> {
    ctx.accounts.stablecoin_state.paused = false;

    emit!(StablecoinUnpaused {
        mint: ctx.accounts.stablecoin_state.mint,
        by: ctx.accounts.pauser.key(),
    });

    Ok(())
}

#[event]
pub struct StablecoinPaused {
    pub mint: Pubkey,
    pub by: Pubkey,
}

#[event]
pub struct StablecoinUnpaused {
    pub mint: Pubkey,
    pub by: Pubkey,
}
