import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';

// Devnet RPC endpoint
const DEVNET_RPC = 'https://api.devnet.solana.com';

// Memo Program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Create connection to devnet
export function getConnection(): Connection {
  return new Connection(DEVNET_RPC, 'confirmed');
}

// Generate new keypair
export function generateKeypair(): Keypair {
  return Keypair.generate();
}

// Restore keypair from secret key bytes
export function keypairFromSecretKey(secretKey: Uint8Array): Keypair {
  return Keypair.fromSecretKey(secretKey);
}

// Get public key as base58 string
export function getPublicKeyString(keypair: Keypair): string {
  return keypair.publicKey.toBase58();
}

// Get secret key as Uint8Array
export function getSecretKeyBytes(keypair: Keypair): Uint8Array {
  return keypair.secretKey;
}

// Check wallet balance
export async function getBalance(publicKey: string): Promise<number> {
  const connection = getConnection();
  const pubkey = new PublicKey(publicKey);
  const balance = await connection.getBalance(pubkey);
  return balance / LAMPORTS_PER_SOL;
}

// Request airdrop (devnet only)
export async function requestAirdrop(
  publicKey: string,
  amount: number = 1
): Promise<string> {
  const connection = getConnection();
  const pubkey = new PublicKey(publicKey);
  
  const signature = await connection.requestAirdrop(
    pubkey,
    amount * LAMPORTS_PER_SOL
  );
  
  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  
  return signature;
}

// Create and send memo transaction
export async function sendMemoTransaction(
  keypair: Keypair,
  memo: string
): Promise<string> {
  const connection = getConnection();
  
  // Create memo instruction
  const memoInstruction = new TransactionInstruction({
    keys: [
      {
        pubkey: keypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
    ],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, 'utf-8'),
  });
  
  // Create transaction
  const transaction = new Transaction().add(memoInstruction);
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = keypair.publicKey;
  
  // Sign and send
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [keypair],
    { commitment: 'confirmed' }
  );
  
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

// Validate if string is valid base58 public key
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Export bs58 for use elsewhere
export { bs58 };

