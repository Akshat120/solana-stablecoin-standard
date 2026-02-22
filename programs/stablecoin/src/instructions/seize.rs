use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, TransferChecked},
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::{error::StablecoinError, state::*};

#[derive(Accounts)]
pub struct Seize<'info> {
    #[account(mut)]
    pub seizer: Signer<'info>,

    #[account(
        seeds = [StablecoinState::SEED, mint.key().as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.compliance_enabled @ StablecoinError::ComplianceNotEnabled,
        constraint = stablecoin_state.permanent_delegate_enabled @ StablecoinError::ComplianceNotEnabled,
        constraint = stablecoin_state.is_seizer(&seizer.key()) @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    #[account(address = stablecoin_state.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Blacklist entry must exist for this address
    pub target_address: UncheckedAccount<'info>,

    #[account(
        seeds = [BlacklistEntry::SEED, stablecoin_state.key().as_ref(), target_address.key().as_ref()],
        bump = blacklist_entry.bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    #[account(mut, token::mint = mint, token::authority = target_address)]
    pub from_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = mint)]
    pub to_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Seize>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::InvalidAmount);
    require!(!ctx.accounts.stablecoin_state.paused, StablecoinError::Paused);

    let mint_key = ctx.accounts.mint.key();
    let seeds = &[
        StablecoinState::SEED,
        mint_key.as_ref(),
        &[ctx.accounts.stablecoin_state.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let decimals = ctx.accounts.mint.decimals;

    // Transfer via permanent delegate authority (stablecoin_state PDA)
    token_2022::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.from_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.to_token_account.to_account_info(),
                authority: ctx.accounts.stablecoin_state.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        decimals,
    )?;

    emit!(TokensSeized {
        mint: ctx.accounts.mint.key(),
        from: ctx.accounts.from_token_account.key(),
        to: ctx.accounts.to_token_account.key(),
        amount,
        seizer: ctx.accounts.seizer.key(),
    });

    Ok(())
}

#[event]
pub struct TokensSeized {
    pub mint: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub seizer: Pubkey,
}
