use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, FreezeAccount, ThawAccount},
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::{error::StablecoinError, state::*};

#[derive(Accounts)]
pub struct FreezeTokenAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [StablecoinState::SEED, mint.key().as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.authority == authority.key() @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    #[account(mut, address = stablecoin_state.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, token::mint = mint)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ThawTokenAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [StablecoinState::SEED, mint.key().as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.authority == authority.key() @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    #[account(mut, address = stablecoin_state.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, token::mint = mint)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn freeze_handler(ctx: Context<FreezeTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    let seeds = &[
        StablecoinState::SEED,
        mint_key.as_ref(),
        &[ctx.accounts.stablecoin_state.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token_2022::freeze_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.stablecoin_state.to_account_info(),
            },
            signer_seeds,
        ),
    )?;

    emit!(AccountFrozen {
        mint: ctx.accounts.mint.key(),
        account: ctx.accounts.token_account.key(),
    });

    Ok(())
}

pub fn thaw_handler(ctx: Context<ThawTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    let seeds = &[
        StablecoinState::SEED,
        mint_key.as_ref(),
        &[ctx.accounts.stablecoin_state.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token_2022::thaw_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            ThawAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.stablecoin_state.to_account_info(),
            },
            signer_seeds,
        ),
    )?;

    emit!(AccountThawed {
        mint: ctx.accounts.mint.key(),
        account: ctx.accounts.token_account.key(),
    });

    Ok(())
}

#[event]
pub struct AccountFrozen {
    pub mint: Pubkey,
    pub account: Pubkey,
}

#[event]
pub struct AccountThawed {
    pub mint: Pubkey,
    pub account: Pubkey,
}
