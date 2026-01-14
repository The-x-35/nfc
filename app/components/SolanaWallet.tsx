'use client';

import { useState } from 'react';
import { isNFCSupported } from '../lib/nfc';
import { encryptWithPIN, decryptWithPIN, encodeWalletData, decodeWalletData } from '../lib/crypto';
import { Keypair } from '@solana/web3.js';
import {
  generateKeypair,
  keypairFromSecretKey,
  getPublicKeyString,
  getSecretKeyBytes,
  getBalance,
  requestAirdrop,
  sendMemoTransaction,
  getSolscanUrl,
  getSolscanAddressUrl,
} from '../lib/solana';

type Mode = 'create' | 'sign';

export default function SolanaWallet() {
  const [mode, setMode] = useState<Mode>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [memo, setMemo] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const supported = isNFCSupported();

  // Create new wallet and write to NFC
  const handleCreateWallet = async () => {
    if (!pin || pin.length < 4) {
      setError('PIN must be at least 4 characters');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setError(null);
    setStatus(null);
    setIsProcessing(true);
    setWalletAddress(null);

    try {
      setStatus('Generating keypair...');
      const keypair = generateKeypair();
      const publicKey = getPublicKeyString(keypair);
      const secretKey = getSecretKeyBytes(keypair);

      setStatus('Encrypting private key...');
      const encryptedKey = await encryptWithPIN(secretKey, pin);

      // Prepare compact data for NFC (just prefix + encrypted key, ~160 bytes)
      const walletData = encodeWalletData(encryptedKey);
      
      console.log('Wallet data size:', walletData.length, 'bytes');
      setStatus(`Tap your NFC tag to write wallet (${walletData.length} bytes)...`);
      
      // Write to NFC using MIME type for better compatibility
      const reader = new (window as unknown as { NDEFReader: new () => NDEFReader }).NDEFReader();
      
      try {
        await reader.write({
          records: [
            {
              recordType: 'mime',
              mediaType: 'application/x-solana-wallet',
              data: new TextEncoder().encode(walletData),
            },
          ],
        });
      } catch (writeError: unknown) {
        const errMsg = writeError instanceof Error ? writeError.message : String(writeError);
        if (errMsg.includes('IO error')) {
          throw new Error(
            'NFC write failed. This usually means:\n' +
            '• Tag moved away too quickly - hold it steady\n' +
            '• Tag is full or read-only\n' +
            '• Tag doesn\'t support NDEF format\n\n' +
            'Try a different NFC tag (NTAG213/215/216 recommended).'
          );
        }
        throw writeError;
      }

      setWalletAddress(publicKey);
      setStatus('Wallet created successfully!');
      setPin('');
      setConfirmPin('');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to create wallet';
      setError(errMsg);
      setStatus(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Sign transaction with wallet from NFC
  const handleSignTransaction = async () => {
    if (!pin || pin.length < 4) {
      setError('Please enter your PIN');
      return;
    }
    if (!memo.trim()) {
      setError('Please enter a memo message');
      return;
    }

    setError(null);
    setStatus(null);
    setTxSignature(null);
    setIsProcessing(true);

    try {
      setStatus('Tap your NFC tag to read wallet...');
      
      // Read from NFC
      const reader = new (window as unknown as { NDEFReader: new () => NDEFReader }).NDEFReader();
      
      const walletData = await new Promise<string>((resolve, reject) => {
        reader.onreading = (event: NDEFReadingEvent) => {
          for (const record of event.message.records) {
            // Support both MIME type and text records
            if (record.data) {
              const decoder = new TextDecoder(record.encoding || 'utf-8');
              const text = decoder.decode(record.data);
              if (text.startsWith('SOL1:')) {
                resolve(text);
                return;
              }
            }
          }
          reject(new Error('No Solana wallet found on NFC tag. Make sure you created a wallet on this tag first.'));
        };
        reader.onreadingerror = () => reject(new Error('Failed to read NFC tag'));
        reader.scan().catch(reject);
      });

      setStatus('Decrypting wallet...');
      const encryptedKey = decodeWalletData(walletData);
      
      let secretKeyBytes: Uint8Array;
      try {
        secretKeyBytes = await decryptWithPIN(encryptedKey, pin);
      } catch {
        throw new Error('Incorrect PIN or corrupted wallet data');
      }

      // Derive keypair from secret key
      const keypair = Keypair.fromSecretKey(secretKeyBytes);
      const publicKey = keypair.publicKey.toBase58();
      setWalletAddress(publicKey);

      setStatus('Checking balance...');
      let balance = await getBalance(publicKey);

      if (balance < 0.001) {
        setStatus('Requesting devnet airdrop...');
        await requestAirdrop(publicKey, 1);
        balance = await getBalance(publicKey);
      }

      setStatus(`Balance: ${balance.toFixed(4)} SOL. Sending memo transaction...`);
      const signature = await sendMemoTransaction(keypair, memo);

      setTxSignature(signature);
      setStatus('Transaction sent successfully!');
      setMemo('');
      setPin('');

      // Open Solscan in new tab
      window.open(getSolscanUrl(signature), '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign transaction');
      setStatus(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Solana NFC Wallet</h1>
        <p className="text-slate-400">Store your wallet on NFC, sign transactions on devnet</p>
      </div>

      {/* Compatibility Warning */}
      {!supported && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-amber-500">Browser Not Supported</h3>
              <p className="text-amber-400/80 text-sm mt-1">
                Web NFC is only available on Chrome 89+ on Android devices.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex rounded-xl bg-slate-800/50 p-1">
        <button
          onClick={() => {
            setMode('create');
            setError(null);
            setStatus(null);
          }}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            mode === 'create'
              ? 'bg-purple-500 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Create Wallet
        </button>
        <button
          onClick={() => {
            setMode('sign');
            setError(null);
            setStatus(null);
          }}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            mode === 'sign'
              ? 'bg-purple-500 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Sign Transaction
        </button>
      </div>

      {/* Create Wallet Form */}
      {mode === 'create' && (
        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
            <p className="text-purple-300 text-sm">
              This will generate a new Solana wallet and store the encrypted private key on your NFC tag.
              Your PIN is used to encrypt the key - remember it!
            </p>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">PIN (min 4 characters)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN to encrypt wallet"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Confirm PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Confirm your PIN"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Sign Transaction Form */}
      {mode === 'sign' && (
        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
            <p className="text-purple-300 text-sm">
              Read your wallet from NFC tag, airdrop devnet SOL if needed, and send a memo transaction.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Memo Message</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Enter your memo to write on-chain..."
              className="w-full h-24 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Wallet PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your wallet PIN"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Wallet Address Display */}
      {walletAddress && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Wallet Address</div>
          <div className="flex items-center gap-2">
            <code className="text-purple-400 text-sm break-all flex-1">{walletAddress}</code>
            <a
              href={getSolscanAddressUrl(walletAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}

      {/* Transaction Signature Display */}
      {txSignature && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="text-green-400 text-sm mb-1">Transaction Signature</div>
          <div className="flex items-center gap-2">
            <code className="text-green-300 text-xs break-all flex-1">{txSignature}</code>
            <a
              href={getSolscanUrl(txSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}

      {/* Status Display */}
      {status && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            {isProcessing && (
              <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <p className="text-blue-400">{status}</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={mode === 'create' ? handleCreateWallet : handleSignTransaction}
        disabled={isProcessing || !supported}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
          isProcessing
            ? 'bg-purple-600 text-white cursor-wait'
            : supported
            ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-lg shadow-purple-500/25'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : mode === 'create' ? (
          'Create Wallet & Write to NFC'
        ) : (
          'Read NFC & Sign Transaction'
        )}
      </button>

      {/* Security Warning */}
      <div className="bg-slate-800/30 rounded-xl p-4">
        <h3 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Security Notice
        </h3>
        <ul className="text-slate-400 text-sm space-y-1">
          <li>• Your private key is encrypted with your PIN before storage</li>
          <li>• Anyone with your NFC tag AND PIN can access your wallet</li>
          <li>• This is for devnet/testing only - not for mainnet funds</li>
          <li>• Keep your NFC tag secure and remember your PIN</li>
        </ul>
      </div>
    </div>
  );
}

// Type declarations for Web NFC API
interface NDEFReader {
  scan(): Promise<void>;
  write(message: { records: NDEFRecordInit[] }): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}

interface NDEFRecordInit {
  recordType: string;
  data?: string;
  lang?: string;
}

interface NDEFReadingEvent extends Event {
  message: {
    records: Array<{
      recordType: string;
      data?: DataView;
      encoding?: string;
    }>;
  };
}

