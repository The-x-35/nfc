'use client';

import { useState } from 'react';
import Navbar from './components/Navbar';
import ReadNFC from './components/ReadNFC';
import WriteText from './components/WriteText';
import WriteURL from './components/WriteURL';
import WriteEmail from './components/WriteEmail';
import WritePhone from './components/WritePhone';
import WriteSMS from './components/WriteSMS';
import WriteWiFi from './components/WriteWiFi';
import SolanaWallet from './components/SolanaWallet';

export default function Home() {
  const [currentPage, setCurrentPage] = useState('read');

  const renderPage = () => {
    switch (currentPage) {
      case 'read':
        return <ReadNFC />;
      case 'wallet':
        return <SolanaWallet />;
      case 'write-text':
        return <WriteText />;
      case 'write-url':
        return <WriteURL />;
      case 'write-email':
        return <WriteEmail />;
      case 'write-phone':
        return <WritePhone />;
      case 'write-sms':
        return <WriteSMS />;
      case 'write-wifi':
        return <WriteWiFi />;
      default:
        return <ReadNFC />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />
      
      <main className="max-w-2xl mx-auto px-4 py-8">
        {renderPage()}
      </main>

      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-slate-500 text-sm">
          NFC Tools - Read and write NFC tags directly from your browser.
          <br />
          <span className="text-slate-600">Requires Chrome 89+ on Android</span>
        </div>
      </footer>
    </div>
  );
}
