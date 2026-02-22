use anchor_lang::prelude::*;
use crate::{error::StablecoinError, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct UpdateMinterParams {
    pub quota: u64, // 0 = unlimited
    pub active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct UpdateRolesParams {
    pub pauser: Option<Pubkey>,
    pub burner: Option<Pubkey>,
    pub blacklister: Option<Pubkey>,
    pub seizer: Option<Pubkey>,
}

#[derive(Accounts)]
#[instruction(params: UpdateMinterParams)]
pub struct UpdateMinter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [StablecoinState::SEED, stablecoin_state.mint.as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.authority == authority.key() @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,

    /// CHECK: The minter's pubkey
    pub minter: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = MinterState::SPACE,
        seeds = [MinterState::SEED, stablecoin_state.key().as_ref(), minter.key().as_ref()],
        bump,
    )]
    pub minter_state: Account<'info, MinterState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRoles<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [StablecoinState::SEED, stablecoin_state.mint.as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.authority == authority.key() @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut)]
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [StablecoinState::SEED, stablecoin_state.mint.as_ref()],
        bump = stablecoin_state.bump,
        constraint = stablecoin_state.pending_authority == Some(new_authority.key()) @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,
}

pub fn update_minter_handler(ctx: Context<UpdateMinter>, params: UpdateMinterParams) -> Result<()> {
    let minter_state = &mut ctx.accounts.minter_state;
    let old_quota = minter_state.quota;

    minter_state.minter = ctx.accounts.minter.key();
    minter_state.stablecoin_state = ctx.accounts.stablecoin_state.key();
    // Reset minted_this_period when quota changes
    if params.quota != old_quota {
        minter_state.minted_this_period = 0;
    }
    minter_state.quota = params.quota;
    minter_state.active = params.active;
    minter_state.bump = ctx.bumps.minter_state;

    emit!(MinterUpdated {
        mint: ctx.accounts.stablecoin_state.mint,
        minter: ctx.accounts.minter.key(),
        quota: params.quota,
        active: params.active,
    });

    Ok(())
}

pub fn update_roles_handler(ctx: Context<UpdateRoles>, params: UpdateRolesParams) -> Result<()> {
    let state = &mut ctx.accounts.stablecoin_state;

    // Validate SSS-2 roles
    if params.blacklister.is_some() || params.seizer.is_some() {
        require!(state.compliance_enabled, StablecoinError::ComplianceNotEnabled);
    }

    state.pauser = params.pauser;
    state.burner = params.burner;
    state.blacklister = params.blacklister;
    state.seizer = params.seizer;

    emit!(RolesUpdated {
        mint: state.mint,
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}

pub fn transfer_authority_handler(ctx: Context<TransferAuthority>) -> Result<()> {
    let state = &mut ctx.accounts.stablecoin_state;
    let old_authority = state.authority;
    state.authority = ctx.accounts.new_authority.key();
    state.pending_authority = None;

    emit!(AuthorityTransferred {
        mint: state.mint,
        old_authority,
        new_authority: ctx.accounts.new_authority.key(),
    });

    Ok(())
}

#[event]
pub struct MinterUpdated {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub quota: u64,
    pub active: bool,
}

#[event]
pub struct RolesUpdated {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct AuthorityTransferred {
    pub mint: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}
