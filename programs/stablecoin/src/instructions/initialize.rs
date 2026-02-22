use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;

use crate::{error::StablecoinError, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InitializeParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    /// Enable SSS-2 compliance features
    pub enable_compliance: bool,
    /// Enable permanent delegate (SSS-2)
    pub enable_permanent_delegate: bool,
    /// Enable transfer hook (SSS-2)
    pub enable_transfer_hook: bool,
    /// Default account state frozen (SSS-2)
    pub default_account_frozen: bool,
    /// Transfer hook program ID (SSS-2, required if enable_transfer_hook)
    pub transfer_hook_program_id: Option<Pubkey>,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = StablecoinState::space(&params.name, &params.symbol, &params.uri),
        seeds = [StablecoinState::SEED, mint.key().as_ref()],
        bump,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    /// CHECK: Token-2022 mint pre-created by caller; used only as PDA seed.
    /// Mint extensions (PermanentDelegate, TransferHook, etc.) are set before
    /// this instruction, so we accept any account here.
    pub mint: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    // Validate params
    require!(params.name.len() <= 32, StablecoinError::NameTooLong);
    require!(params.symbol.len() <= 10, StablecoinError::SymbolTooLong);
    require!(params.uri.len() <= 200, StablecoinError::UriTooLong);

    // SSS-2 validation: compliance extensions require compliance mode
    if params.enable_permanent_delegate || params.enable_transfer_hook || params.default_account_frozen {
        require!(params.enable_compliance, StablecoinError::ComplianceNotEnabled);
    }

    let state = &mut ctx.accounts.stablecoin_state;
    state.authority = ctx.accounts.authority.key();
    state.pending_authority = None;
    state.mint = ctx.accounts.mint.key();
    state.name = params.name;
    state.symbol = params.symbol;
    state.uri = params.uri;
    state.decimals = params.decimals;
    state.compliance_enabled = params.enable_compliance;
    state.permanent_delegate_enabled = params.enable_permanent_delegate;
    state.transfer_hook_enabled = params.enable_transfer_hook;
    state.default_account_frozen = params.default_account_frozen;
    state.paused = false;
    state.pauser = None;
    state.burner = None;
    state.blacklister = None;
    state.seizer = None;
    state.total_minted = 0;
    state.total_burned = 0;
    state.bump = ctx.bumps.stablecoin_state;

    emit!(StablecoinInitialized {
        mint: ctx.accounts.mint.key(),
        authority: ctx.accounts.authority.key(),
        compliance_enabled: params.enable_compliance,
    });

    Ok(())
}

#[event]
pub struct StablecoinInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub compliance_enabled: bool,
}
