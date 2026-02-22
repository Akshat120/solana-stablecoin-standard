use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta,
    seeds::Seed,
    state::ExtraAccountMetaList,
};

declare_id!("AZNBS6e6giRaefJod9DsAqUJSXqbUf8WzPwSuJWjYVCj");

/// Seeds for the ExtraAccountMetaList PDA
pub const EXTRA_ACCOUNT_META_LIST_SEED: &[u8] = b"extra-account-metas";
/// Seeds for blacklist entry (must match stablecoin program)
pub const BLACKLIST_SEED: &[u8] = b"blacklist";
/// Seeds for stablecoin state (must match stablecoin program)
pub const STABLECOIN_STATE_SEED: &[u8] = b"stablecoin_state";

/// The stablecoin program ID - set at deployment
pub const STABLECOIN_PROGRAM_ID: Pubkey = pubkey!("5KEn7iFu6sRahbgMyG6zaQG13ntWWfiRz1Rc1pY9sF6u");

#[program]
pub mod transfer_hook {
    use super::*;

    /// Initialize the ExtraAccountMetaList for a mint
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // We need extra accounts for blacklist checking:
        // 1. The stablecoin state PDA
        // 2. The blacklist entry PDA for the sender
        // 3. The blacklist entry PDA for the receiver
        let account_metas = vec![
            // Stablecoin state - derived from mint
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal { bytes: STABLECOIN_STATE_SEED.to_vec() },
                    Seed::AccountKey { index: 1 }, // mint is account index 1 in transfer
                ],
                false, // not a signer
                false, // not writable
            )?,
            // Sender blacklist entry - derived from stablecoin state + sender wallet
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal { bytes: BLACKLIST_SEED.to_vec() },
                    Seed::AccountKey { index: 5 }, // extra account 0 = stablecoin_state
                    Seed::AccountKey { index: 3 }, // owner of source token account
                ],
                false,
                false,
            )?,
            // Receiver blacklist entry
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal { bytes: BLACKLIST_SEED.to_vec() },
                    Seed::AccountKey { index: 5 }, // extra account 0 = stablecoin_state
                    Seed::AccountKey { index: 4 }, // owner of destination token account
                ],
                false,
                false,
            )?,
        ];

        let extra_account_metas_account = &ctx.accounts.extra_account_meta_list;

        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut extra_account_metas_account.try_borrow_mut_data()?,
            &account_metas,
        )?;

        Ok(())
    }

    /// Transfer hook - called on every Token-2022 transfer
    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        // Check if sender blacklist entry exists (account will be empty if not blacklisted)
        let sender_blacklist = &ctx.accounts.sender_blacklist_entry;
        if sender_blacklist.data_len() > 0 && !sender_blacklist.data_is_empty() {
            // Account exists = blacklisted
            return err!(TransferHookError::SenderBlacklisted);
        }

        // Check if receiver blacklist entry exists
        let receiver_blacklist = &ctx.accounts.receiver_blacklist_entry;
        if receiver_blacklist.data_len() > 0 && !receiver_blacklist.data_is_empty() {
            return err!(TransferHookError::ReceiverBlacklisted);
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList account - initialized via raw data write
    #[account(
        init,
        seeds = [EXTRA_ACCOUNT_META_LIST_SEED, mint.key().as_ref()],
        bump,
        space = ExtraAccountMetaList::size_of(3).unwrap(),
        payer = payer,
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(token::mint = mint, token::authority = owner_source)]
    pub source_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(token::mint = mint)]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Source token account owner
    pub owner_source: UncheckedAccount<'info>,

    /// CHECK: ExtraAccountMetaList
    #[account(
        seeds = [EXTRA_ACCOUNT_META_LIST_SEED, mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CHECK: Stablecoin state - validated by seeds matching
    pub stablecoin_state: UncheckedAccount<'info>,

    /// CHECK: Sender blacklist entry - empty if not blacklisted
    pub sender_blacklist_entry: UncheckedAccount<'info>,

    /// CHECK: Receiver blacklist entry - empty if not blacklisted
    pub receiver_blacklist_entry: UncheckedAccount<'info>,
}

#[error_code]
pub enum TransferHookError {
    #[msg("Sender is blacklisted")]
    SenderBlacklisted,
    #[msg("Receiver is blacklisted")]
    ReceiverBlacklisted,
}
