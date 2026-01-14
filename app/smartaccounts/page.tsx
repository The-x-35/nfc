'use client';

import { useState } from 'react';
import Link from 'next/link';
import { isNFCSupported } from '../lib/nfc';
import { encryptWithPIN, decryptWithPIN } from '../lib/crypto';
import {
  generateSeed,
  deriveEthPrivateKey,
  deriveSolPrivateKey,
  bytesToHex,
  encodeSeedData,
  decodeSeedData,
} from '../lib/seed';
import {
  getSmartAccountAddress,
  sendMemoTransaction as sendEthMemo,
  getEtherscanUrl,
  getEtherscanAddressUrl,
  isZeroDevConfigured,
} from '../lib/zerodev';
import {
  keypairFromSeed,
  getSwigAddress,
  createSwigAccount,
  getBalance,
  requestAirdrop,
  sendSwigMemoTransaction,
  getSolscanUrl,
  getSolscanAddressUrl,
} from '../lib/swig';

type Mode = 'create' | 'sign-eth' | 'sign-sol';

export default function SmartAccountsPage() {
  const [mode, setMode] = useState<Mode>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [memo, setMemo] = useState('');
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [solAddress, setSolAddress] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txChain, setTxChain] = useState<'eth' | 'sol' | null>(null);

  const supported = isNFCSupported();
  const zeroDevConfigured = isZeroDevConfigured();

  // Create smart accounts and write seed to NFC
  const handleCreateAccounts = async () => {
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
    setEthAddress(null);
    setSolAddress(null);

    try {
      setStatus('Generating seed...');
      const seed = generateSeed();

      setStatus('Deriving Ethereum key...');
      const ethKey = await deriveEthPrivateKey(seed);
      const ethKeyHex = bytesToHex(ethKey);

      setStatus('Deriving Solana key...');
      const solKey = await deriveSolPrivateKey(seed);
      const solKeypair = keypairFromSeed(solKey);

      // Get addresses
      let ethAddr = 'ZeroDev not configured';
      if (zeroDevConfigured) {
        setStatus('Creating Ethereum smart account...');
        ethAddr = await getSmartAccountAddress(ethKeyHex);
      }
      
      setStatus('Getting Solana smart account address...');
      const swigAddr = getSwigAddress(solKey);

      setStatus('Encrypting seed...');
      const encryptedSeed = await encryptWithPIN(seed, pin);
      const seedData = encodeSeedData(encryptedSeed);

      setStatus(`Writing to NFC (${seedData.length} bytes)...`);

      // Write to NFC
      const reader = new (window as unknown as { NDEFReader: new () => NDEFReader }).NDEFReader();
      await reader.write({
        records: [
          {
            recordType: 'mime',
            mediaType: 'application/x-smart-account-seed',
            data: new TextEncoder().encode(seedData),
          },
        ],
      });

      setEthAddress(ethAddr);
      setSolAddress(swigAddr.toBase58());
      setStatus('Smart accounts created successfully!');
      setPin('');
      setConfirmPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create accounts');
      setStatus(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Sign ETH transaction
  const handleSignEth = async () => {
    if (!pin || pin.length < 4) {
      setError('Please enter your PIN');
      return;
    }
    if (!memo.trim()) {
      setError('Please enter a memo message');
      return;
    }
    if (!zeroDevConfigured) {
      setError('ZeroDev not configured. Set NEXT_PUBLIC_ZERODEV_PROJECT_ID in .env.local');
      return;
    }

    setError(null);
    setStatus(null);
    setTxHash(null);
    setIsProcessing(true);

    try {
      setStatus('Reading NFC tag...');

      const reader = new (window as unknown as { NDEFReader: new () => NDEFReader }).NDEFReader();
      const seedData = await new Promise<string>((resolve, reject) => {
        reader.onreading = (event: NDEFReadingEvent) => {
          for (const record of event.message.records) {
            if (record.data) {
              const text = new TextDecoder().decode(record.data);
              if (text.startsWith('SEED1:')) {
                resolve(text);
                return;
              }
            }
          }
          reject(new Error('No smart account seed found on NFC tag'));
        };
        reader.onreadingerror = () => reject(new Error('Failed to read NFC tag'));
        reader.scan().catch(reject);
      });

      setStatus('Decrypting seed...');
      const encryptedSeed = decodeSeedData(seedData);
      let seed: Uint8Array;
      try {
        seed = await decryptWithPIN(encryptedSeed, pin);
      } catch {
        throw new Error('Incorrect PIN');
      }

      setStatus('Deriving Ethereum key...');
      const ethKey = await deriveEthPrivateKey(seed);
      const ethKeyHex = bytesToHex(ethKey);

      setStatus('Getting smart account address...');
      const address = await getSmartAccountAddress(ethKeyHex);
      setEthAddress(address);

      setStatus('Sending memo transaction on Sepolia...');
      const hash = await sendEthMemo(ethKeyHex, memo);

      setTxHash(hash);
      setTxChain('eth');
      setStatus('Transaction sent successfully!');
      setMemo('');
      setPin('');

      window.open(getEtherscanUrl(hash), '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign transaction');
      setStatus(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Sign SOL transaction
  const handleSignSol = async () => {
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
    setTxHash(null);
    setIsProcessing(true);

    try {
      setStatus('Reading NFC tag...');

      const reader = new (window as unknown as { NDEFReader: new () => NDEFReader }).NDEFReader();
      const seedData = await new Promise<string>((resolve, reject) => {
        reader.onreading = (event: NDEFReadingEvent) => {
          for (const record of event.message.records) {
            if (record.data) {
              const text = new TextDecoder().decode(record.data);
              if (text.startsWith('SEED1:')) {
                resolve(text);
                return;
              }
            }
          }
          reject(new Error('No smart account seed found on NFC tag'));
        };
        reader.onreadingerror = () => reject(new Error('Failed to read NFC tag'));
        reader.scan().catch(reject);
      });

      setStatus('Decrypting seed...');
      const encryptedSeed = decodeSeedData(seedData);
      let seed: Uint8Array;
      try {
        seed = await decryptWithPIN(encryptedSeed, pin);
      } catch {
        throw new Error('Incorrect PIN');
      }

      setStatus('Deriving Solana key...');
      const solKey = await deriveSolPrivateKey(seed);
      const keypair = keypairFromSeed(solKey);

      setStatus('Checking Swig account...');
      const swigAddr = getSwigAddress(solKey);
      setSolAddress(swigAddr.toBase58());

      // Check if payer has SOL
      let balance = await getBalance(keypair.publicKey);
      if (balance < 0.01) {
        setStatus('Requesting devnet airdrop...');
        await requestAirdrop(keypair.publicKey, 1);
        balance = await getBalance(keypair.publicKey);
      }

      setStatus('Creating Swig account if needed...');
      await createSwigAccount(keypair, solKey);

      setStatus(`Balance: ${balance.toFixed(4)} SOL. Sending memo...`);
      const signature = await sendSwigMemoTransaction(keypair, solKey, memo);

      setTxHash(signature);
      setTxChain('sol');
      setStatus('Transaction sent successfully!');
      setMemo('');
      setPin('');

      window.open(getSolscanUrl(signature), '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign transaction');
      setStatus(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-white font-semibold text-lg">Smart Accounts</span>
            </Link>
            <Link href="/" className="text-slate-400 hover:text-white text-sm">
              ← Back to NFC Tools
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Smart Accounts</h1>
          <p className="text-slate-400">Store encrypted seed on NFC, derive ETH & SOL smart accounts</p>
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
        <div className="flex rounded-xl bg-slate-800/50 p-1 gap-1">
          <button
            onClick={() => { setMode('create'); setError(null); setStatus(null); }}
            className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${
              mode === 'create' ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => { setMode('sign-eth'); setError(null); setStatus(null); }}
            className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${
              mode === 'sign-eth' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign ETH
          </button>
          <button
            onClick={() => { setMode('sign-sol'); setError(null); setStatus(null); }}
            className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${
              mode === 'sign-sol' ? 'bg-green-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign SOL
          </button>
        </div>

        {/* Create Form */}
        {mode === 'create' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 rounded-xl p-4">
              <p className="text-violet-300 text-sm">
                Generate a new seed, derive Ethereum (ZeroDev) and Solana (Swig) smart accounts,
                and store the encrypted seed on your NFC tag.
              </p>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">PIN (min 4 characters)</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN to encrypt seed"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Confirm PIN</label>
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm your PIN"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        )}

        {/* Sign ETH Form */}
        {mode === 'sign-eth' && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <p className="text-blue-300 text-sm">
                Read seed from NFC, derive ETH smart account via ZeroDev, and send a memo transaction on Sepolia.
                {!zeroDevConfigured && (
                  <span className="block mt-2 text-amber-400">
                    ⚠️ Set NEXT_PUBLIC_ZERODEV_PROJECT_ID in .env.local
                  </span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Memo Message</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Enter memo to write on-chain..."
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter your PIN"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Sign SOL Form */}
        {mode === 'sign-sol' && (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-green-300 text-sm">
                Read seed from NFC, derive SOL smart account via Swig, and send a memo transaction on Devnet.
              </p>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Memo Message</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Enter memo to write on-chain..."
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter your PIN"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}

        {/* Addresses Display */}
        {(ethAddress || solAddress) && (
          <div className="space-y-3">
            {ethAddress && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-slate-400 text-sm">ETH Smart Account (Sepolia)</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-blue-400 text-sm break-all flex-1">{ethAddress}</code>
                  {ethAddress !== 'ZeroDev not configured' && (
                    <a href={getEtherscanAddressUrl(ethAddress)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            )}

            {solAddress && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-slate-400 text-sm">SOL Smart Account (Devnet)</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-green-400 text-sm break-all flex-1">{solAddress}</code>
                  <a href={getSolscanAddressUrl(solAddress)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transaction Hash Display */}
        {txHash && (
          <div className={`border rounded-xl p-4 ${txChain === 'eth' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <div className="text-sm mb-1" style={{ color: txChain === 'eth' ? '#93c5fd' : '#86efac' }}>
              Transaction {txChain === 'eth' ? '(Sepolia)' : '(Devnet)'}
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs break-all flex-1" style={{ color: txChain === 'eth' ? '#60a5fa' : '#4ade80' }}>
                {txHash}
              </code>
              <a
                href={txChain === 'eth' ? getEtherscanUrl(txHash) : getSolscanUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className={txChain === 'eth' ? 'text-blue-400 hover:text-blue-300' : 'text-green-400 hover:text-green-300'}
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
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              {isProcessing && (
                <svg className="animate-spin h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <p className="text-violet-300">{status}</p>
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
          onClick={mode === 'create' ? handleCreateAccounts : mode === 'sign-eth' ? handleSignEth : handleSignSol}
          disabled={isProcessing || !supported}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            isProcessing
              ? 'bg-slate-600 text-white cursor-wait'
              : supported
              ? mode === 'create'
                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white shadow-lg shadow-violet-500/25'
                : mode === 'sign-eth'
                ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/25'
                : 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/25'
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
            'Create Accounts & Write to NFC'
          ) : mode === 'sign-eth' ? (
            'Read NFC & Sign ETH Transaction'
          ) : (
            'Read NFC & Sign SOL Transaction'
          )}
        </button>
      </main>

      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-slate-500 text-sm">
          Smart Accounts - ETH (ZeroDev/Sepolia) & SOL (Swig/Devnet)
        </div>
      </footer>
    </div>
  );
}

// Type declarations for Web NFC API
interface NDEFReader {
  scan(): Promise<void>;
  write(message: { records: { recordType: string; mediaType?: string; data?: Uint8Array }[] }): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
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

