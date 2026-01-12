'use client';

import { useState } from 'react';
import { readNFCTag, isNFCSupported, NFCTagInfo } from '../lib/nfc';

export default function ReadNFC() {
  const [isReading, setIsReading] = useState(false);
  const [tagInfo, setTagInfo] = useState<NFCTagInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRead = async () => {
    setError(null);
    setTagInfo(null);
    setIsReading(true);

    try {
      const info = await readNFCTag();
      setTagInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read NFC tag');
    } finally {
      setIsReading(false);
    }
  };

  const supported = isNFCSupported();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Read NFC Tag</h1>
        <p className="text-slate-400">Tap your NFC tag to read its contents</p>
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
                Web NFC is only available on Chrome 89+ on Android devices. Please open this page on an Android device using Chrome.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Read Button */}
      <button
        onClick={handleRead}
        disabled={isReading || !supported}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
          isReading
            ? 'bg-cyan-600 text-white cursor-wait'
            : supported
            ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/25'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isReading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Waiting for NFC Tag...
          </span>
        ) : (
          'Read NFC Tag'
        )}
      </button>

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

      {/* Tag Info Display */}
      {tagInfo && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold text-white">NFC Tag Info</h2>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-slate-500 text-sm">Serial Number</div>
                <div className="text-white font-mono mt-1">{tagInfo.serialNumber}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-slate-500 text-sm">Record Count</div>
                <div className="text-white font-mono mt-1">{tagInfo.recordCount}</div>
              </div>
            </div>

            {tagInfo.records.length > 0 && (
              <div>
                <h3 className="text-slate-400 text-sm mb-2">Records</h3>
                <div className="space-y-2">
                  {tagInfo.records.map((record, index) => (
                    <div key={index} className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                          {record.type}
                        </span>
                      </div>
                      <div className="text-white break-all">{record.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-slate-800/30 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-2">Instructions</h3>
        <ul className="text-slate-400 text-sm space-y-1">
          <li>• Ensure NFC is enabled on your device</li>
          <li>• Press the &quot;Read NFC Tag&quot; button</li>
          <li>• Hold your NFC tag near the back of your phone</li>
          <li>• The tag data will appear above</li>
        </ul>
      </div>
    </div>
  );
}

