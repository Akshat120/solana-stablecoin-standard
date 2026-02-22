use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, MintTo, Token2022},
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::{error::StablecoinError, state::*};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(
        mut,
        seeds = [StablecoinState::SEED, mint.key().as_ref()],
        bump = stablecoin_state.bump,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    #[account(
        mut,
        seeds = [MinterState::SEED, stablecoin_state.key().as_ref(), minter.key().as_ref()],
        bump = minter_state.bump,
        constraint = minter_state.stablecoin_state == stablecoin_state.key(),
        constraint = minter_state.minter == minter.key(),
    )]
    pub minter_state: Account<'info, MinterState>,

    #[account(mut, address = stablecoin_state.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, token::mint = mint)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::InvalidAmount);

    // Extract values we need before taking mutable references
    let state_bump = ctx.accounts.stablecoin_state.bump;
    let mint_key = ctx.accounts.mint.key();

    {
        let state = &ctx.accounts.stablecoin_state;
        require!(!state.paused, StablecoinError::Paused);
    }

    {
        let minter_state = &ctx.accounts.minter_state;
        require!(minter_state.active, StablecoinError::Unauthorized);
        require!(minter_state.can_mint(amount), StablecoinError::QuotaExceeded);
    }

    // Mint via token program
    let seeds = &[
        StablecoinState::SEED,
        mint_key.as_ref(),
        &[state_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token_2022::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.stablecoin_state.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    ctx.accounts.minter_state.minted_this_period += amount;
    ctx.accounts.stablecoin_state.total_minted += amount;

    emit!(TokensMinted {
        mint: ctx.accounts.mint.key(),
        recipient: ctx.accounts.recipient_token_account.key(),
        amount,
        minter: ctx.accounts.minter.key(),
    });

    Ok(())
}

#[event]
pub struct TokensMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub minter: Pubkey,
}
