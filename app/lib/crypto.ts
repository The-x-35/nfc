// Simple fast encryption for NFC wallet storage

// Simple hash function for PIN
async function hashPIN(pin: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// XOR encrypt/decrypt (symmetric)
function xorCrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

// Encrypt private key with PIN - super fast
export async function encryptWithPIN(
  data: Uint8Array,
  pin: string
): Promise<string> {
  const key = await hashPIN(pin);
  const encrypted = xorCrypt(data, key);
  // Return as base64
  return btoa(String.fromCharCode(...encrypted));
}

// Decrypt private key with PIN - super fast
export async function decryptWithPIN(
  encryptedBase64: string,
  pin: string
): Promise<Uint8Array> {
  const encrypted = new Uint8Array(
    atob(encryptedBase64)
      .split('')
      .map((c) => c.charCodeAt(0))
  );
  const key = await hashPIN(pin);
  return xorCrypt(encrypted, key);
}

// Wallet data format: "SOL1:" + base64(encrypted_key)
const WALLET_PREFIX = 'SOL1:';

export function encodeWalletData(encryptedKey: string): string {
  return WALLET_PREFIX + encryptedKey;
}

export function decodeWalletData(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith(WALLET_PREFIX)) {
    throw new Error('Invalid wallet data format. Not a Solana NFC wallet.');
  }
  return trimmed.slice(WALLET_PREFIX.length);
}

export function isWalletData(text: string): boolean {
  return text.trim().startsWith(WALLET_PREFIX);
}
