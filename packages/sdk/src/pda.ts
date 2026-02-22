import { PublicKey } from "@solana/web3.js";

export const STABLECOIN_STATE_SEED = Buffer.from("stablecoin_state");
export const MINTER_SEED = Buffer.from("minter");
export const BLACKLIST_SEED = Buffer.from("blacklist");
export const EXTRA_ACCOUNT_META_LIST_SEED = Buffer.from("extra-account-metas");

export function findStablecoinStatePDA(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STABLECOIN_STATE_SEED, mint.toBuffer()],
    programId
  );
}

export function findMinterStatePDA(
  stablecoinState: PublicKey,
  minter: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINTER_SEED, stablecoinState.toBuffer(), minter.toBuffer()],
    programId
  );
}

export function findBlacklistEntryPDA(
  stablecoinState: PublicKey,
  address: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, stablecoinState.toBuffer(), address.toBuffer()],
    programId
  );
}

export function findExtraAccountMetaListPDA(
  mint: PublicKey,
  transferHookProgramId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_META_LIST_SEED, mint.toBuffer()],
    transferHookProgramId
  );
}
