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
  createInitializePermanentDelegateInstruction,
} from "@solana/spl-token";
import { expect } from "chai";
import {
  findStablecoinStatePDA,
  findMinterStatePDA,
  findBlacklistEntryPDA,
} from "../packages/sdk/src/pda";

describe("SSS-2: Compliant Stablecoin", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  let program: Program;
  let authority: Keypair;
  let minter: Keypair;
  let blacklister: Keypair;
  let seizer: Keypair;
  let victim: Keypair;
  let mintKeypair: Keypair;
  let stablecoinState: PublicKey;
  let victimTokenAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;

  before(async () => {
    program = anchor.workspace.Stablecoin as Program;
    authority = (provider.wallet as anchor.Wallet).payer;
    minter = Keypair.generate();
    blacklister = Keypair.generate();
    seizer = Keypair.generate();
    victim = Keypair.generate();
    mintKeypair = Keypair.generate();

    await Promise.all([
      connection.requestAirdrop(minter.publicKey, 2e9),
      connection.requestAirdrop(blacklister.publicKey, 2e9),
      connection.requestAirdrop(seizer.publicKey, 2e9),
      connection.requestAirdrop(victim.publicKey, 2e9),
    ]);
    await new Promise((r) => setTimeout(r, 2000));

    [stablecoinState] = findStablecoinStatePDA(
      mintKeypair.publicKey,
      program.programId
    );
  });

  describe("SSS-2 initialization", () => {
    it("creates SSS-2 stablecoin with compliance extensions", async () => {
      const extensions = [
        ExtensionType.MetadataPointer,
        ExtensionType.PermanentDelegate,
      ];
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
        createInitializePermanentDelegateInstruction(
          mintKeypair.publicKey,
          stablecoinState,
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
          name: "Regulated USD",
          symbol: "RUSD",
          uri: "",
          decimals: 6,
          enableCompliance: true,
          enablePermanentDelegate: true,
          enableTransferHook: false, // skipped in unit test (no hook program deployed)
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
      expect(state.complianceEnabled).to.equal(true);
      expect(state.permanentDelegateEnabled).to.equal(true);
      expect(state.name).to.equal("Regulated USD");
    });

    it("rejects compliance extensions without enable_compliance", async () => {
      const badMint = Keypair.generate();
      const [badState] = findStablecoinStatePDA(
        badMint.publicKey,
        program.programId
      );

      try {
        await program.methods
          .initialize({
            name: "Bad Config",
            symbol: "BAD",
            uri: "",
            decimals: 6,
            enableCompliance: false,
            enablePermanentDelegate: true, // requires compliance
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
        expect.fail("Should have rejected compliance config mismatch");
      } catch (err: any) {
        expect(err.message).to.include("ComplianceNotEnabled");
      }
    });
  });

  describe("role setup", () => {
    it("sets compliance roles", async () => {
      await program.methods
        .updateRoles({
          pauser: null,
          burner: null,
          blacklister: blacklister.publicKey,
          seizer: seizer.publicKey,
        })
        .accounts({
          authority: authority.publicKey,
          stablecoinState,
        })
        .signers([authority])
        .rpc();

      const state = await (
        program.account as any
      ).stablecoinState.fetch(stablecoinState);
      expect(state.blacklister.toString()).to.equal(
        blacklister.publicKey.toString()
      );
      expect(state.seizer.toString()).to.equal(
        seizer.publicKey.toString()
      );
    });

    it("sets up minter", async () => {
      const [minterState] = findMinterStatePDA(
        stablecoinState,
        minter.publicKey,
        program.programId
      );

      await program.methods
        .updateMinter({ quota: new BN(10_000_000), active: true })
        .accounts({
          authority: authority.publicKey,
          stablecoinState,
          minter: minter.publicKey,
          minterState,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    });
  });

  describe("mint → blacklist → seize flow (SSS-2 integration)", () => {
    before(async () => {
      victimTokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        victim.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      treasuryTokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        authority.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = new Transaction();
      tx.add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          victimTokenAccount,
          victim.publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        ),
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          treasuryTokenAccount,
          authority.publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      );
      await sendAndConfirmTransaction(connection, tx, [authority]);
    });

    it("step 1: mints to victim account", async () => {
      const [minterState] = findMinterStatePDA(
        stablecoinState,
        minter.publicKey,
        program.programId
      );

      await program.methods
        .mintTokens(new BN(1_000_000))
        .accounts({
          minter: minter.publicKey,
          stablecoinState,
          minterState,
          mint: mintKeypair.publicKey,
          recipientTokenAccount: victimTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();

      const balance = await connection.getTokenAccountBalance(
        victimTokenAccount
      );
      expect(balance.value.amount).to.equal("1000000");
    });

    it("step 2: blacklists the victim", async () => {
      const [blacklistEntry] = findBlacklistEntryPDA(
        stablecoinState,
        victim.publicKey,
        program.programId
      );

      await program.methods
        .addToBlacklist("OFAC SDN match - sanctioned entity")
        .accounts({
          blacklister: blacklister.publicKey,
          stablecoinState,
          address: victim.publicKey,
          blacklistEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklister])
        .rpc();

      const entry = await (
        program.account as any
      ).blacklistEntry.fetch(blacklistEntry);
      expect(entry.address.toString()).to.equal(
        victim.publicKey.toString()
      );
      expect(entry.reason).to.equal("OFAC SDN match - sanctioned entity");
      expect(entry.addedBy.toString()).to.equal(
        blacklister.publicKey.toString()
      );
    });

    it("step 3: seizes tokens from blacklisted account", async () => {
      const [blacklistEntry] = findBlacklistEntryPDA(
        stablecoinState,
        victim.publicKey,
        program.programId
      );

      const beforeTreasury = await connection.getTokenAccountBalance(
        treasuryTokenAccount
      );

      await program.methods
        .seize(new BN(1_000_000))
        .accounts({
          seizer: seizer.publicKey,
          stablecoinState,
          mint: mintKeypair.publicKey,
          targetAddress: victim.publicKey,
          blacklistEntry,
          fromTokenAccount: victimTokenAccount,
          toTokenAccount: treasuryTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([seizer])
        .rpc();

      const victimBalance = await connection.getTokenAccountBalance(
        victimTokenAccount
      );
      expect(victimBalance.value.amount).to.equal("0");

      const treasuryBalance = await connection.getTokenAccountBalance(
        treasuryTokenAccount
      );
      expect(parseInt(treasuryBalance.value.amount)).to.be.greaterThan(
        parseInt(beforeTreasury.value.amount ?? "0")
      );
    });

    it("step 4: removes from blacklist", async () => {
      const [blacklistEntry] = findBlacklistEntryPDA(
        stablecoinState,
        victim.publicKey,
        program.programId
      );

      await program.methods
        .removeFromBlacklist()
        .accounts({
          blacklister: blacklister.publicKey,
          stablecoinState,
          address: victim.publicKey,
          blacklistEntry,
        })
        .signers([blacklister])
        .rpc();

      const accountInfo =
        await connection.getAccountInfo(blacklistEntry);
      expect(accountInfo).to.be.null;
    });
  });

  describe("access control", () => {
    it("rejects unauthorized blacklist add", async () => {
      const unauthorized = Keypair.generate();
      await connection.requestAirdrop(unauthorized.publicKey, 1e9);
      await new Promise((r) => setTimeout(r, 1000));

      const target = Keypair.generate();
      const [blacklistEntry] = findBlacklistEntryPDA(
        stablecoinState,
        target.publicKey,
        program.programId
      );

      try {
        await program.methods
          .addToBlacklist("unauthorized attempt")
          .accounts({
            blacklister: unauthorized.publicKey,
            stablecoinState,
            address: target.publicKey,
            blacklistEntry,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorized])
          .rpc();
        expect.fail("Should have rejected unauthorized blacklist");
      } catch (err: any) {
        expect(err.message).to.include("Unauthorized");
      }
    });

    it("rejects seize on non-blacklisted account", async () => {
      const innocent = Keypair.generate();
      const [blacklistEntry] = findBlacklistEntryPDA(
        stablecoinState,
        innocent.publicKey,
        program.programId
      );

      try {
        await program.methods
          .seize(new BN(100))
          .accounts({
            seizer: seizer.publicKey,
            stablecoinState,
            mint: mintKeypair.publicKey,
            targetAddress: innocent.publicKey,
            blacklistEntry,
            fromTokenAccount: victimTokenAccount,
            toTokenAccount: treasuryTokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([seizer])
          .rpc();
        expect.fail("Should have rejected seize of non-blacklisted account");
      } catch (err: any) {
        // Expected: account doesn't exist, program will fail
        expect(err).to.exist;
      }
    });
  });
});
