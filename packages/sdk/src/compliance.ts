import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BlacklistEntry, BlacklistOptions, SeizeOptions } from "./types";
import { findBlacklistEntryPDA, findStablecoinStatePDA } from "./pda";

export class ComplianceModule {
  private connection: Connection;
  private program: Program;
  private mint: PublicKey;
  private programId: PublicKey;
  private stablecoinState: PublicKey;

  constructor(
    connection: Connection,
    program: Program,
    mint: PublicKey,
    programId: PublicKey
  ) {
    this.connection = connection;
    this.program = program;
    this.mint = mint;
    this.programId = programId;
    const [statePDA] = findStablecoinStatePDA(mint, programId);
    this.stablecoinState = statePDA;
  }

  /**
   * Add an address to the blacklist (SSS-2 only)
   */
  async blacklistAdd(
    options: BlacklistOptions,
    blacklister: Keypair
  ): Promise<string> {
    const [blacklistEntry] = findBlacklistEntryPDA(
      this.stablecoinState,
      options.address,
      this.programId
    );

    const tx = await this.program.methods
      .addToBlacklist(options.reason)
      .accounts({
        blacklister: blacklister.publicKey,
        stablecoinState: this.stablecoinState,
        address: options.address,
        blacklistEntry,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklister])
      .rpc();

    return tx;
  }

  /**
   * Remove an address from the blacklist (SSS-2 only)
   */
  async blacklistRemove(
    address: PublicKey,
    blacklister: Keypair
  ): Promise<string> {
    const [blacklistEntry] = findBlacklistEntryPDA(
      this.stablecoinState,
      address,
      this.programId
    );

    const tx = await this.program.methods
      .removeFromBlacklist()
      .accounts({
        blacklister: blacklister.publicKey,
        stablecoinState: this.stablecoinState,
        address,
        blacklistEntry,
      })
      .signers([blacklister])
      .rpc();

    return tx;
  }

  /**
   * Check if an address is blacklisted
   */
  async isBlacklisted(address: PublicKey): Promise<boolean> {
    const [blacklistEntry] = findBlacklistEntryPDA(
      this.stablecoinState,
      address,
      this.programId
    );

    const accountInfo = await this.connection.getAccountInfo(blacklistEntry);
    return accountInfo !== null;
  }

  /**
   * Get blacklist entry details
   */
  async getBlacklistEntry(
    address: PublicKey
  ): Promise<BlacklistEntry | null> {
    const [blacklistEntry] = findBlacklistEntryPDA(
      this.stablecoinState,
      address,
      this.programId
    );

    try {
      const entry = await (this.program.account as any).blacklistEntry.fetch(
        blacklistEntry
      );
      return {
        address: entry.address.toString(),
        reason: entry.reason,
        timestamp: entry.timestamp.toNumber(),
        addedBy: entry.addedBy.toString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Seize tokens from a blacklisted account via permanent delegate (SSS-2 only)
   */
  async seize(options: SeizeOptions, seizer: Keypair): Promise<string> {
    const [blacklistEntry] = findBlacklistEntryPDA(
      this.stablecoinState,
      options.fromAccount,
      this.programId
    );

    const tx = await this.program.methods
      .seize(new BN(options.amount.toString()))
      .accounts({
        seizer: seizer.publicKey,
        stablecoinState: this.stablecoinState,
        mint: this.mint,
        targetAddress: options.fromAccount,
        blacklistEntry,
        fromTokenAccount: options.fromAccount,
        toTokenAccount: options.toAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([seizer])
      .rpc();

    return tx;
  }

  /**
   * Export audit log of all blacklist events for this stablecoin
   */
  async getAuditLog(): Promise<any[]> {
    const accounts = await (
      this.program.account as any
    ).blacklistEntry.all([
      {
        memcmp: {
          offset: 8, // skip discriminator
          bytes: this.stablecoinState.toBase58(),
        },
      },
    ]);

    return accounts.map((a: any) => ({
      address: a.account.address.toString(),
      reason: a.account.reason,
      timestamp: new Date(
        a.account.timestamp.toNumber() * 1000
      ).toISOString(),
      addedBy: a.account.addedBy.toString(),
      pda: a.publicKey.toString(),
    }));
  }
}
