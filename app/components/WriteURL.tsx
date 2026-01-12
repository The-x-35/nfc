'use client';

import { useState } from 'react';
import { writeURLToNFC, isNFCSupported } from '../lib/nfc';

export default function WriteURL() {
  const [url, setUrl] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWrite = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Add https:// if no protocol specified
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = 'https://' + url;
    }

    setError(null);
    setSuccess(false);
    setIsWriting(true);

    try {
      await writeURLToNFC(finalUrl);
      setSuccess(true);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to write to NFC tag');
    } finally {
      setIsWriting(false);
    }
  };

  const supported = isNFCSupported();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Write URL</h1>
        <p className="text-slate-400">Write a website link to your NFC tag</p>
      </div>

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

      <div>
        <label className="block text-slate-300 text-sm font-medium mb-2">Website URL</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-400">Successfully wrote URL to NFC tag!</p>
          </div>
        </div>
      )}

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

      <button
        onClick={handleWrite}
        disabled={isWriting || !supported}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
          isWriting
            ? 'bg-cyan-600 text-white cursor-wait'
            : supported
            ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/25'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isWriting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Tap NFC Tag to Write...
          </span>
        ) : (
          'Write URL to NFC Tag'
        )}
      </button>
    </div>
  );
}

