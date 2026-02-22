import { PublicKey } from "@solana/web3.js";

export interface StablecoinConfig {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  // SSS-2 compliance
  enableCompliance?: boolean;
  enablePermanentDelegate?: boolean;
  enableTransferHook?: boolean;
  defaultAccountFrozen?: boolean;
  transferHookProgramId?: PublicKey;
}

export interface MintOptions {
  recipient: PublicKey;
  amount: bigint;
  minter: import("@solana/web3.js").Keypair;
}

export interface BurnOptions {
  fromAccount: PublicKey;
  amount: bigint;
}

export interface BlacklistOptions {
  address: PublicKey;
  reason: string;
}

export interface SeizeOptions {
  fromAccount: PublicKey;
  toAccount: PublicKey;
  amount: bigint;
}

export interface UpdateMinterOptions {
  minter: PublicKey;
  quota?: bigint; // 0 = unlimited
  active: boolean;
}

export interface UpdateRolesOptions {
  pauser?: PublicKey | null;
  burner?: PublicKey | null;
  blacklister?: PublicKey | null;
  seizer?: PublicKey | null;
}

export interface StablecoinStatus {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  paused: boolean;
  complianceEnabled: boolean;
  totalMinted: bigint;
  totalBurned: bigint;
  supply: bigint;
  authority: string;
}

export interface MinterInfo {
  minter: string;
  quota: bigint;
  mintedThisPeriod: bigint;
  active: boolean;
}

export interface BlacklistEntry {
  address: string;
  reason: string;
  timestamp: number;
  addedBy: string;
}

export enum Preset {
  SSS_1 = "sss-1",
  SSS_2 = "sss-2",
}

export interface PresetConfig extends Partial<StablecoinConfig> {
  preset: Preset;
}
