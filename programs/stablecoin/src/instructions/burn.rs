use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, Burn, Token2022},
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::{error::StablecoinError, state::*};

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [StablecoinState::SEED, mint.key().as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.is_burner(&burner.key()) @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    #[account(mut, address = stablecoin_state.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, token::mint = mint)]
    pub burn_from_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::InvalidAmount);

    let state = &mut ctx.accounts.stablecoin_state;
    require!(!state.paused, StablecoinError::Paused);

    token_2022::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.burn_from_account.to_account_info(),
                authority: ctx.accounts.burner.to_account_info(),
            },
        ),
        amount,
    )?;

    state.total_burned += amount;

    emit!(TokensBurned {
        mint: ctx.accounts.mint.key(),
        from: ctx.accounts.burn_from_account.key(),
        amount,
        burner: ctx.accounts.burner.key(),
    });

    Ok(())
}

#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub from: Pubkey,
    pub amount: u64,
    pub burner: Pubkey,
}
