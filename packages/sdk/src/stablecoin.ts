import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import StablecoinIdl from "./idl/stablecoin.json";

// Real program IDs (updated after anchor build)
export const STABLECOIN_PROGRAM_ID = new PublicKey(
  "Xv1J7SAGmEMGcULWPZPD7X3SVWt1EsT41fKXPq5XcdK"
);
export const TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  "AZNBS6e6giRaefJod9DsAqUJSXqbUf8WzPwSuJWjYVCj"
);
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferHookInstruction,
  createInitializeDefaultAccountStateInstruction,
  getMintLen,
  ExtensionType,
  AccountState,
} from "@solana/spl-token";
import {
  StablecoinConfig,
  MintOptions,
  BurnOptions,
  UpdateMinterOptions,
  UpdateRolesOptions,
  StablecoinStatus,
  MinterInfo,
  Preset,
  PresetConfig,
} from "./types";
import { getPresetConfig, mergeWithPreset } from "./presets";
import { ComplianceModule } from "./compliance";
import { findStablecoinStatePDA, findMinterStatePDA } from "./pda";

export class SolanaStablecoin {
  readonly connection: Connection;
  readonly program: Program;
  readonly mintAddress: PublicKey;
  readonly programId: PublicKey;
  private stablecoinState: PublicKey;

  /**
   * Compliance module (SSS-2 only)
   */
  readonly compliance: ComplianceModule;

  private constructor(
    connection: Connection,
    program: Program,
    mint: PublicKey,
    programId: PublicKey
  ) {
    this.connection = connection;
    this.program = program;
    this.mintAddress = mint;
    this.programId = programId;
    const [statePDA] = findStablecoinStatePDA(mint, programId);
    this.stablecoinState = statePDA;
    this.compliance = new ComplianceModule(
      connection,
      program,
      mint,
      programId
    );
  }

  /**
   * Create a new stablecoin using a preset or custom config
   *
   * @example
   * // SSS-1 preset
   * const stable = await SolanaStablecoin.create(connection, {
   *   preset: Presets.SSS_1,
   *   name: "My Stablecoin",
   *   symbol: "MYUSD",
   *   decimals: 6,
   *   authority: adminKeypair,
   * });
   *
   * // SSS-2 preset
   * const compliant = await SolanaStablecoin.create(connection, {
   *   preset: Presets.SSS_2,
   *   name: "Regulated USD",
   *   symbol: "RUSD",
   *   decimals: 6,
   *   authority: adminKeypair,
   *   transferHookProgramId: hookProgramId,
   * });
   */
  static async create(
    connection: Connection,
    config: (PresetConfig | StablecoinConfig) & {
      authority: Keypair;
      programId?: PublicKey;
    }
  ): Promise<SolanaStablecoin> {
    const programId = config.programId ?? STABLECOIN_PROGRAM_ID;

    // Resolve config from preset if specified
    let resolvedConfig: Partial<StablecoinConfig>;
    if ("preset" in config && config.preset) {
      resolvedConfig = mergeWithPreset(
        config.preset,
        config as Partial<StablecoinConfig>
      );
    } else {
      resolvedConfig = config as Partial<StablecoinConfig>;
    }

    if (!resolvedConfig.name || !resolvedConfig.symbol) {
      throw new Error("name and symbol are required");
    }

    const authority = config.authority;

    const provider = new AnchorProvider(connection, new Wallet(authority), {
      commitment: "confirmed",
    });

    const program = new Program(StablecoinIdl as any, provider);

    // Generate a new mint keypair
    const mintKeypair = Keypair.generate();

    // Determine Token-2022 extensions needed
    const extensions: ExtensionType[] = [ExtensionType.MetadataPointer];

    if (resolvedConfig.enablePermanentDelegate) {
      extensions.push(ExtensionType.PermanentDelegate);
    }
    if (resolvedConfig.enableTransferHook) {
      extensions.push(ExtensionType.TransferHook);
    }
    if (resolvedConfig.defaultAccountFrozen) {
      extensions.push(ExtensionType.DefaultAccountState);
    }

    const mintLen = getMintLen(extensions);
    const lamports =
      await connection.getMinimumBalanceForRentExemption(mintLen);

    const [stablecoinState] = findStablecoinStatePDA(
      mintKeypair.publicKey,
      programId
    );

    // Build mint initialization transaction
    const transaction = new Transaction();

    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mintKeypair.publicKey,
        authority.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    if (resolvedConfig.enablePermanentDelegate) {
      transaction.add(
        createInitializePermanentDelegateInstruction(
          mintKeypair.publicKey,
          stablecoinState,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    if (
      resolvedConfig.enableTransferHook &&
      resolvedConfig.transferHookProgramId
    ) {
      transaction.add(
        createInitializeTransferHookInstruction(
          mintKeypair.publicKey,
          authority.publicKey,
          resolvedConfig.transferHookProgramId,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    if (resolvedConfig.defaultAccountFrozen) {
      transaction.add(
        createInitializeDefaultAccountStateInstruction(
          mintKeypair.publicKey,
          AccountState.Frozen,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    transaction.add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        resolvedConfig.decimals ?? 6,
        stablecoinState,
        stablecoinState,
        TOKEN_2022_PROGRAM_ID
      )
    );

    await provider.sendAndConfirm(transaction, [authority, mintKeypair]);

    // Initialize program state
    await program.methods
      .initialize({
        name: resolvedConfig.name,
        symbol: resolvedConfig.symbol,
        uri: resolvedConfig.uri ?? "",
        decimals: resolvedConfig.decimals ?? 6,
        enableCompliance: resolvedConfig.enableCompliance ?? false,
        enablePermanentDelegate:
          resolvedConfig.enablePermanentDelegate ?? false,
        enableTransferHook: resolvedConfig.enableTransferHook ?? false,
        defaultAccountFrozen: resolvedConfig.defaultAccountFrozen ?? false,
        transferHookProgramId: resolvedConfig.transferHookProgramId ?? null,
      })
      .accounts({
        authority: authority.publicKey,
        stablecoinState,
        mint: mintKeypair.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();

    return new SolanaStablecoin(
      connection,
      program,
      mintKeypair.publicKey,
      programId
    );
  }

  /**
   * Load an existing stablecoin by mint address
   */
  static async load(
    connection: Connection,
    mint: PublicKey,
    authority: Keypair,
    programId?: PublicKey
  ): Promise<SolanaStablecoin> {
    const pid = programId ?? STABLECOIN_PROGRAM_ID;

    const provider = new AnchorProvider(connection, new Wallet(authority), {
      commitment: "confirmed",
    });

    const program = new Program(StablecoinIdl as any, provider);

    return new SolanaStablecoin(connection, program, mint, pid);
  }

  /**
   * Mint tokens to a recipient
   */
  async mint(options: MintOptions): Promise<string> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);
    const [minterState] = findMinterStatePDA(
      statePDA,
      options.minter.publicKey,
      this.programId
    );

    const recipientTokenAccount = getAssociatedTokenAddressSync(
      this.mintAddress,
      options.recipient,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = await this.program.methods
      .mintTokens(new BN(options.amount.toString()))
      .accounts({
        minter: options.minter.publicKey,
        stablecoinState: statePDA,
        minterState,
        mint: this.mintAddress,
        recipientTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([options.minter])
      .rpc();

    return tx;
  }

  /**
   * Burn tokens from an account
   */
  async burn(options: BurnOptions, burner: Keypair): Promise<string> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);

    const tx = await this.program.methods
      .burnTokens(new BN(options.amount.toString()))
      .accounts({
        burner: burner.publicKey,
        stablecoinState: statePDA,
        mint: this.mintAddress,
        burnFromAccount: options.fromAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([burner])
      .rpc();

    return tx;
  }

  /**
   * Freeze a token account
   */
  async freeze(tokenAccount: PublicKey, authority: Keypair): Promise<string> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);

    const tx = await this.program.methods
      .freezeAccount()
      .accounts({
        authority: authority.publicKey,
        stablecoinState: statePDA,
        mint: this.mintAddress,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  /**
   * Thaw a frozen token account
   */
  async thaw(tokenAccount: PublicKey, authority: Keypair): Promise<string> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);

    const tx = await this.program.methods
      .thawAccount()
      .accounts({
        authority: authority.publicKey,
        stablecoinState: statePDA,
        mint: this.mintAddress,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  /**
   * Pause all minting and burning
   */
  async pause(pauser: Keypair): Promise<string> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);

    const tx = await this.program.methods
      .pause()
      .accounts({
        pauser: pauser.publicKey,
        stablecoinState: statePDA,
      })
      .signers([pauser])
      .rpc();

    return tx;
  }

  /**
   * Unpause operations
   */
  async unpause(pauser: Keypair): Promise<string> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);

    const tx = await this.program.methods
      .unpause()
      .accounts({
        pauser: pauser.publicKey,
        stablecoinState: statePDA,
      })
      .signers([pauser])
      .rpc();

    return tx;
  }

  /**
   * Add or update a minter with optional quota
   */
  async updateMinter(
    options: UpdateMinterOptions,
    authority: Keypair
  ): Promise<string> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);
    const [minterState] = findMinterStatePDA(
      statePDA,
      options.minter,
      this.programId
    );

    const tx = await this.program.methods
      .updateMinter({
        quota: new BN((options.quota ?? 0n).toString()),
        active: options.active,
      })
      .accounts({
        authority: authority.publicKey,
        stablecoinState: statePDA,
        minter: options.minter,
        minterState,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  /**
   * Update roles (pauser, burner, blacklister, seizer)
   */
  async updateRoles(
    options: UpdateRolesOptions,
    authority: Keypair
  ): Promise<string> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);

    const tx = await this.program.methods
      .updateRoles({
        pauser: options.pauser ?? null,
        burner: options.burner ?? null,
        blacklister: options.blacklister ?? null,
        seizer: options.seizer ?? null,
      })
      .accounts({
        authority: authority.publicKey,
        stablecoinState: statePDA,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  /**
   * Get stablecoin status
   */
  async getStatus(): Promise<StablecoinStatus> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);
    const state = await (this.program.account as any).stablecoinState.fetch(
      statePDA
    );

    const supply = await this.getTotalSupply();

    return {
      mint: this.mintAddress.toString(),
      name: state.name,
      symbol: state.symbol,
      decimals: state.decimals,
      paused: state.paused,
      complianceEnabled: state.complianceEnabled,
      totalMinted: BigInt(state.totalMinted.toString()),
      totalBurned: BigInt(state.totalBurned.toString()),
      supply,
      authority: state.authority.toString(),
    };
  }

  /**
   * Get current token supply
   */
  async getTotalSupply(): Promise<bigint> {
    const mintInfo = await this.connection.getTokenSupply(this.mintAddress);
    return BigInt(mintInfo.value.amount);
  }

  /**
   * Get minter info
   */
  async getMinterInfo(minter: PublicKey): Promise<MinterInfo | null> {
    const [statePDA] = findStablecoinStatePDA(this.mintAddress, this.programId);
    const [minterState] = findMinterStatePDA(statePDA, minter, this.programId);

    try {
      const state = await (this.program.account as any).minterState.fetch(
        minterState
      );
      return {
        minter: state.minter.toString(),
        quota: BigInt(state.quota.toString()),
        mintedThisPeriod: BigInt(state.mintedThisPeriod.toString()),
        active: state.active,
      };
    } catch {
      return null;
    }
  }
}
