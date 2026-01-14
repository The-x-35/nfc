// Swig smart account utilities for Solana (Devnet)

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  findSwigPda,
  fetchSwig,
  getCreateSwigInstructionContext,
  getSignInstructionContext,
  createEd25519AuthorityInfo,
  ActionsBuilder,
  SolPublicKey,
  SolInstruction,
} from '@swig-wallet/classic';

// Devnet RPC
const DEVNET_RPC = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_RPC, 'confirmed');

// Memo Program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Create Swig smart account
export async function createSwigAccount(
  payer: Keypair,
  id: Uint8Array
): Promise<{ swigAddress: PublicKey; txSignature: string }> {
  // Find Swig PDA
  const swigAddress = findSwigPda(id);

  // Check if already exists
  const existingAccount = await connection.getAccountInfo(swigAddress);
  if (existingAccount) {
    return { swigAddress, txSignature: '' };
  }

  // Create authority info for the payer
  const authorityInfo = createEd25519AuthorityInfo(payer.publicKey.toBase58());

  // Build actions with all permissions
  const actions = ActionsBuilder.new().all().get();

  // Create Swig account instruction context
  const createCtx = await getCreateSwigInstructionContext({
    id,
    actions,
    authorityInfo,
    payer: payer.publicKey.toBase58(),
  });

  // Build transaction from instruction context
  const instructions = createCtx.getWeb3Instructions();
  const tx = new Transaction();
  for (const ix of instructions) {
    tx.add(new TransactionInstruction({
      programId: new PublicKey(ix.programId.toBase58()),
      keys: ix.keys.map((k: { pubkey: { toBase58(): string }; isSigner: boolean; isWritable: boolean }) => ({
        pubkey: new PublicKey(k.pubkey.toBase58()),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })),
      data: Buffer.from(ix.data),
    }));
  }

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;

  const txSignature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
  });

  return { swigAddress, txSignature };
}

// Get Swig account address from ID
export function getSwigAddress(id: Uint8Array): PublicKey {
  return findSwigPda(id);
}

// Check wallet balance
export async function getBalance(publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

// Request airdrop
export async function requestAirdrop(publicKey: PublicKey, amount: number = 1): Promise<string> {
  const signature = await connection.requestAirdrop(publicKey, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// Send memo transaction via Swig
export async function sendSwigMemoTransaction(
  payer: Keypair,
  id: Uint8Array,
  memo: string
): Promise<string> {
  const swigAddress = findSwigPda(id);

  // Fetch the Swig account
  const swig = await fetchSwig(connection, swigAddress);

  // Create memo instruction
  const memoInstruction = new SolInstruction({
    program: new SolPublicKey(MEMO_PROGRAM_ID.toBase58()),
    data: new TextEncoder().encode(memo),
    accounts: [],
  });

  // Get sign instruction context from Swig
  const signCtx = await getSignInstructionContext(
    swig,
    0, // roleId
    [memoInstruction]
  );

  // Build transaction from instruction context
  const instructions = signCtx.getWeb3Instructions();
  const tx = new Transaction();
  for (const ix of instructions) {
    tx.add(new TransactionInstruction({
      programId: new PublicKey(ix.programId.toBase58()),
      keys: ix.keys.map((k: { pubkey: { toBase58(): string }; isSigner: boolean; isWritable: boolean }) => ({
        pubkey: new PublicKey(k.pubkey.toBase58()),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })),
      data: Buffer.from(ix.data),
    }));
  }

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;

  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
  });

  return signature;
}

// Get Solscan devnet URL for transaction
export function getSolscanUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}

// Get Solscan devnet URL for address
export function getSolscanAddressUrl(address: string): string {
  return `https://solscan.io/account/${address}?cluster=devnet`;
}

// Create Keypair from 32-byte seed
export function keypairFromSeed(seed: Uint8Array): Keypair {
  // Solana Keypair.fromSeed expects exactly 32 bytes
  if (seed.length !== 32) {
    throw new Error('Seed must be exactly 32 bytes');
  }
  return Keypair.fromSeed(seed);
}
