import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  ExtensionType,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
} from "@solana/spl-token";
import { expect } from "chai";
import {
  findStablecoinStatePDA,
  findMinterStatePDA,
} from "../packages/sdk/src/pda";

describe("SSS-1: Minimal Stablecoin", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  let program: Program;
  let authority: Keypair;
  let minter: Keypair;
  let mintKeypair: Keypair;
  let stablecoinState: PublicKey;

  before(async () => {
    program = anchor.workspace.Stablecoin as Program;
    authority = (provider.wallet as anchor.Wallet).payer;
    minter = Keypair.generate();
    mintKeypair = Keypair.generate();

    await connection.requestAirdrop(minter.publicKey, 2e9);
    await new Promise((r) => setTimeout(r, 2000));

    [stablecoinState] = findStablecoinStatePDA(
      mintKeypair.publicKey,
      program.programId
    );
  });

  describe("initialize", () => {
    it("creates a SSS-1 stablecoin", async () => {
      const extensions = [ExtensionType.MetadataPointer];
      const mintLen = getMintLen(extensions);
      const lamports =
        await connection.getMinimumBalanceForRentExemption(mintLen);

      const tx = new Transaction();
      tx.add(
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
        ),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          6,
          stablecoinState,
          stablecoinState,
          TOKEN_2022_PROGRAM_ID
        )
      );

      await sendAndConfirmTransaction(connection, tx, [
        authority,
        mintKeypair,
      ]);

      await program.methods
        .initialize({
          name: "Test USD",
          symbol: "TUSD",
          uri: "https://example.com/metadata.json",
          decimals: 6,
          enableCompliance: false,
          enablePermanentDelegate: false,
          enableTransferHook: false,
          defaultAccountFrozen: false,
          transferHookProgramId: null,
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

      const state = await (
        program.account as any
      ).stablecoinState.fetch(stablecoinState);
      expect(state.name).to.equal("Test USD");
      expect(state.symbol).to.equal("TUSD");
      expect(state.decimals).to.equal(6);
      expect(state.complianceEnabled).to.equal(false);
      expect(state.paused).to.equal(false);
      expect(state.authority.toString()).to.equal(
        authority.publicKey.toString()
      );
      expect(state.totalMinted.toString()).to.equal("0");
    });

    it("rejects name longer than 32 chars", async () => {
      const badMint = Keypair.generate();
      const [badState] = findStablecoinStatePDA(
        badMint.publicKey,
        program.programId
      );

      try {
        await program.methods
          .initialize({
            name: "A".repeat(33),
            symbol: "TST",
            uri: "",
            decimals: 6,
            enableCompliance: false,
            enablePermanentDelegate: false,
            enableTransferHook: false,
            defaultAccountFrozen: false,
            transferHookProgramId: null,
          })
          .accounts({
            authority: authority.publicKey,
            stablecoinState: badState,
            mint: badMint.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([authority])
          .rpc();
        expect.fail("Should have rejected long name");
      } catch (err: any) {
        expect(err.message).to.include("NameTooLong");
      }
    });
  });

  describe("minter management", () => {
    let minterState: PublicKey;

    before(() => {
      [minterState] = findMinterStatePDA(
        stablecoinState,
        minter.publicKey,
        program.programId
      );
    });

    it("adds a minter with quota", async () => {
      await program.methods
        .updateMinter({ quota: new BN(1_000_000), active: true })
        .accounts({
          authority: authority.publicKey,
          stablecoinState,
          minter: minter.publicKey,
          minterState,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const state = await (
        program.account as any
      ).minterState.fetch(minterState);
      expect(state.minter.toString()).to.equal(
        minter.publicKey.toString()
      );
      expect(state.quota.toString()).to.equal("1000000");
      expect(state.active).to.equal(true);
    });

    it("rejects unauthorized minter update", async () => {
      const unauthorized = Keypair.generate();
      await connection.requestAirdrop(unauthorized.publicKey, 1e9);
      await new Promise((r) => setTimeout(r, 1000));

      try {
        await program.methods
          .updateMinter({ quota: new BN(0), active: true })
          .accounts({
            authority: unauthorized.publicKey,
            stablecoinState,
            minter: minter.publicKey,
            minterState,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorized])
          .rpc();
        expect.fail("Should have rejected");
      } catch (err: any) {
        expect(err.message).to.include("Unauthorized");
      }
    });
  });

  describe("mint tokens", () => {
    let recipientTokenAccount: PublicKey;
    let minterState: PublicKey;

    before(async () => {
      [minterState] = findMinterStatePDA(
        stablecoinState,
        minter.publicKey,
        program.programId
      );

      recipientTokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        authority.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          recipientTokenAccount,
          authority.publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      );
      await sendAndConfirmTransaction(connection, tx, [authority]);
    });

    it("mints tokens within quota", async () => {
      await program.methods
        .mintTokens(new BN(500_000))
        .accounts({
          minter: minter.publicKey,
          stablecoinState,
          minterState,
          mint: mintKeypair.publicKey,
          recipientTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();

      const balance = await connection.getTokenAccountBalance(
        recipientTokenAccount
      );
      expect(balance.value.amount).to.equal("500000");

      const state = await (
        program.account as any
      ).stablecoinState.fetch(stablecoinState);
      expect(state.totalMinted.toString()).to.equal("500000");
    });

    it("rejects minting beyond quota", async () => {
      try {
        await program.methods
          .mintTokens(new BN(600_000)) // quota=1M, minted=500k → 600k would exceed
          .accounts({
            minter: minter.publicKey,
            stablecoinState,
            minterState,
            mint: mintKeypair.publicKey,
            recipientTokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have rejected quota exceeded");
      } catch (err: any) {
        expect(err.message).to.include("QuotaExceeded");
      }
    });
  });

  describe("pause/unpause", () => {
    it("pauses the stablecoin", async () => {
      await program.methods
        .pause()
        .accounts({
          pauser: authority.publicKey,
          stablecoinState,
        })
        .signers([authority])
        .rpc();

      const state = await (
        program.account as any
      ).stablecoinState.fetch(stablecoinState);
      expect(state.paused).to.equal(true);
    });

    it("rejects mint when paused", async () => {
      const [minterState] = findMinterStatePDA(
        stablecoinState,
        minter.publicKey,
        program.programId
      );
      const recipientTokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        authority.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      try {
        await program.methods
          .mintTokens(new BN(100))
          .accounts({
            minter: minter.publicKey,
            stablecoinState,
            minterState,
            mint: mintKeypair.publicKey,
            recipientTokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have rejected when paused");
      } catch (err: any) {
        expect(err.message).to.include("Paused");
      }
    });

    it("unpauses the stablecoin", async () => {
      await program.methods
        .unpause()
        .accounts({
          pauser: authority.publicKey,
          stablecoinState,
        })
        .signers([authority])
        .rpc();

      const state = await (
        program.account as any
      ).stablecoinState.fetch(stablecoinState);
      expect(state.paused).to.equal(false);
    });
  });

  describe("freeze/thaw", () => {
    it("freezes and thaws a token account", async () => {
      const tokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        authority.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      await program.methods
        .freezeAccount()
        .accounts({
          authority: authority.publicKey,
          stablecoinState,
          mint: mintKeypair.publicKey,
          tokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      await program.methods
        .thawAccount()
        .accounts({
          authority: authority.publicKey,
          stablecoinState,
          mint: mintKeypair.publicKey,
          tokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
    });
  });

  describe("SSS-2 instructions rejected on SSS-1", () => {
    it("rejects add_to_blacklist on SSS-1", async () => {
      const victim = Keypair.generate();
      const [blacklistEntry] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("blacklist"),
          stablecoinState.toBuffer(),
          victim.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .addToBlacklist("test reason")
          .accounts({
            blacklister: authority.publicKey,
            stablecoinState,
            address: victim.publicKey,
            blacklistEntry,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("Should have rejected SSS-2 instruction on SSS-1");
      } catch (err: any) {
        expect(err.message).to.include("ComplianceNotEnabled");
      }
    });
  });
});
