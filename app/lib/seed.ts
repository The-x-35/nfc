// Seed generation and HKDF key derivation for smart accounts

// Generate a random 32-byte seed
export function generateSeed(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// HKDF key derivation using Web Crypto API
async function hkdfDerive(
  seed: Uint8Array,
  info: string,
  length: number = 32
): Promise<Uint8Array> {
  // Create a fresh ArrayBuffer copy to satisfy TypeScript
  const seedBuffer = new Uint8Array(seed).buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    seedBuffer,
    'HKDF',
    false,
    ['deriveBits']
  );

  // Derive key using HKDF
  const saltBuffer = new Uint8Array(32).buffer as ArrayBuffer;
  const infoEncoded = new TextEncoder().encode(info);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBuffer,
      info: infoEncoded.buffer as ArrayBuffer,
    },
    keyMaterial,
    length * 8 // bits
  );

  return new Uint8Array(derivedBits);
}

// Derive Ethereum private key from seed
export async function deriveEthPrivateKey(seed: Uint8Array): Promise<Uint8Array> {
  return hkdfDerive(seed, 'ethereum', 32);
}

// Derive Solana private key from seed (64 bytes for full keypair)
export async function deriveSolPrivateKey(seed: Uint8Array): Promise<Uint8Array> {
  // Derive 32 bytes for the seed, Solana will expand to full keypair
  return hkdfDerive(seed, 'solana', 32);
}

// Convert Uint8Array to hex string (for ETH private key)
export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`;
}

// Encode seed for NFC storage
const SEED_PREFIX = 'SEED1:';

export function encodeSeedData(encryptedSeed: string): string {
  return SEED_PREFIX + encryptedSeed;
}

export function decodeSeedData(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith(SEED_PREFIX)) {
    throw new Error('Invalid seed data format. Not a smart account NFC tag.');
  }
  return trimmed.slice(SEED_PREFIX.length);
}

export function isSeedData(text: string): boolean {
  return text.trim().startsWith(SEED_PREFIX);
}

