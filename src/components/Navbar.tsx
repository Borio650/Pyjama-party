import React from 'react';
import { LayoutDashboard, QrCode, ArrowDown } from 'lucide-react';

interface NavbarProps {
  view: 'public' | 'dashboard';
  onSwitchView: (next: 'public' | 'dashboard') => void;
  hasTicket: boolean;
  onOpenTicket: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  view,
  onSwitchView,
  hasTicket,
  onOpenTicket,
}) => {
  const handleGoToRegister = () => {
    if (view !== 'public') {
      onSwitchView('public');
      setTimeout(() => {
        document.getElementById('inscription')?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      document.getElementById('inscription')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => {
            onSwitchView('public');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 rounded"
        >
          Pyjama Party
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        {view === 'public' ? (
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
            {hasTicket && (
              <button
                type="button"
                onClick={onOpenTicket}
                className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 cursor-pointer font-semibold"
                style={{ color: 'var(--brand-accent)' }}
              >
                <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mon ticket</span>
              </button>
            )}
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
            <span className="whitespace-nowrap shrink-0 font-semibold text-slate-900">
              Tableau de bord — Contrôle des présences
            </span>
          </nav>
        )}

        {/* Zone 3: S'inscrire + Tableau de bord side by side */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleGoToRegister}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-opacity hover:opacity-95 whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: 'var(--brand-primary)',
              color: 'var(--brand-primary-fg)',
            }}
          >
            <span>S’inscrire</span>
            <ArrowDown className="w-3.5 h-3.5 shrink-0 hidden sm:inline" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onSwitchView(view === 'dashboard' ? 'public' : 'dashboard')}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'dashboard'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Tableau de bord</span>
          </button>
        </div>
      </div>
    </header>
  );
};
