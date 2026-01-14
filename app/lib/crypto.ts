// AES-256-GCM encryption for NFC wallet storage

// Derive encryption key from PIN using PBKDF2
async function deriveKeyFromPIN(pin: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  
  // Import PIN as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive 256-bit key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('nfc-smart-account-salt'), // Fixed salt for consistency
      iterations: 100000, // Good balance of security and speed
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

// Encrypt data with PIN using AES-256-GCM
export async function encryptWithPIN(
  data: Uint8Array,
  pin: string
): Promise<string> {
  const key = await deriveKeyFromPIN(pin);
  
  // Generate random 12-byte IV (nonce) for GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt with AES-256-GCM
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128, // 16-byte authentication tag
    },
    key,
    data
  );

  // Combine IV + encrypted data (includes auth tag at the end)
  // Format: IV (12 bytes) + encrypted data (32 bytes) + auth tag (16 bytes) = 60 bytes
  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(12 + encryptedArray.length);
  combined.set(iv, 0); // IV at the start
  combined.set(encryptedArray, 12); // Encrypted data + auth tag
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

// Decrypt data with PIN using AES-256-GCM
export async function decryptWithPIN(
  encryptedBase64: string,
  pin: string
): Promise<Uint8Array> {
  // Decode base64
  const combined = new Uint8Array(
    atob(encryptedBase64)
      .split('')
      .map((c) => c.charCodeAt(0))
  );

  // Extract IV (first 12 bytes) and encrypted data (rest)
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const key = await deriveKeyFromPIN(pin);

  // Decrypt with AES-256-GCM (will verify auth tag automatically)
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      key,
      encrypted
    );

    return new Uint8Array(decrypted);
  } catch (error) {
    // Wrong PIN or corrupted data - GCM will fail authentication
    throw new Error('Decryption failed: Incorrect PIN or corrupted data');
  }
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
