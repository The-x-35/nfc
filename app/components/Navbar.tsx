'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const writeOptions = [
  { id: 'text', label: 'Text' },
  { id: 'url', label: 'URL' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'sms', label: 'SMS' },
  { id: 'wifi', label: 'WiFi' },
];

const navItems = [
  { id: 'read', label: 'Read' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'smartaccounts', label: 'Smart Accounts', isLink: true },
];

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onNavigate('read')}
          >
            <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg">NFC Tools</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              item.isLink ? (
                <Link
                  key={item.id}
                  href={`/${item.id}`}
                  className="px-4 py-2 rounded-lg font-medium transition-colors bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === item.id
                      ? item.id === 'wallet' ? 'bg-purple-500 text-white' : 'bg-cyan-500 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              )
            ))}

            {/* Write Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsWriteOpen(!isWriteOpen)}
                onBlur={() => setTimeout(() => setIsWriteOpen(false), 150)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  currentPage.startsWith('write')
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Write
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isWriteOpen && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1">
                  {writeOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        onNavigate(`write-${option.id}`);
                        setIsWriteOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 transition-colors ${
                        currentPage === `write-${option.id}`
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-700">
            <button
              onClick={() => {
                onNavigate('read');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                currentPage === 'read'
                  ? 'bg-cyan-500 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Read NFC
            </button>

            <button
              onClick={() => {
                onNavigate('wallet');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors mt-1 ${
                currentPage === 'wallet'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Solana Wallet
            </button>

            <Link
              href="/smartaccounts"
              className="block w-full text-left px-4 py-3 rounded-lg font-medium transition-colors mt-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Smart Accounts
            </Link>
            
            <div className="mt-2 text-slate-500 text-sm px-4 py-2">Write Options</div>
            {writeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onNavigate(`write-${option.id}`);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  currentPage === `write-${option.id}`
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

