import React from 'react';
import { QrCode, ArrowDown } from 'lucide-react';

interface NavbarProps {
  hasTicket: boolean;
  onOpenTicket: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ hasTicket, onOpenTicket }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#affiche"
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 rounded"
        >
          Pyjama Party
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#affiche"
            className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
          >
            Affiche
          </a>
          <a
            href="#inscription"
            className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
          >
            Inscription
          </a>
          <a
            href="#participants"
            className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
          >
            Participants
          </a>
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          {hasTicket ? (
            <button
              type="button"
              onClick={onOpenTicket}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-opacity hover:opacity-95 whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: 'var(--brand-accent)',
                color: 'var(--brand-accent-fg)',
              }}
            >
              <QrCode className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Mon ticket</span>
            </button>
          ) : (
            <a
              href="#inscription"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: 'var(--brand-primary-fg)',
              }}
            >
              <span>S’inscrire</span>
              <ArrowDown className="w-4 h-4 shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
