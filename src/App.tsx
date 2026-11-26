import { useEffect, useState } from 'react';
import {
  subscribeEventPoster,
  subscribeEventSettings,
  subscribePublicParticipants,
} from './lib/firestoreService';
import { getContrastTextColor } from './lib/imageUtils';
import {
  DEFAULT_BRANCHES,
  DEFAULT_EVENT_SETTINGS,
  type BranchItem,
  type EventPoster,
  type EventSettings,
  type ParticipantPublic,
} from './types/pyjama';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { PosterHero } from './components/PosterHero';
import { RegistrationForm } from './components/RegistrationForm';
import { ParticipantsGallery } from './components/ParticipantsGallery';
import { TicketModal } from './components/TicketModal';
import { TableauDeBord } from './components/TableauDeBord';

const AUTHORIZED_BRANCHES: BranchItem[] = DEFAULT_BRANCHES.map((b) => ({
  ...b,
  created_at: null,
}));

function PyjamaPartyApp() {
  const [view, setView] = useState<'public' | 'dashboard'>('public');

  const [settings, setSettings] = useState<EventSettings>(DEFAULT_EVENT_SETTINGS);
  const [poster, setPoster] = useState<EventPoster | null>(null);
  const [publicParticipants, setPublicParticipants] = useState<ParticipantPublic[]>([]);

  const [latestTicket, setLatestTicket] = useState<ParticipantPublic | null>(null);
  const [modalTicket, setModalTicket] = useState<ParticipantPublic | null>(null);

  // Sync dynamic poster colors to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', settings.theme_primary);
    root.style.setProperty('--brand-primary-fg', getContrastTextColor(settings.theme_primary));
    root.style.setProperty('--brand-accent', settings.theme_accent);
    root.style.setProperty('--brand-accent-fg', getContrastTextColor(settings.theme_accent));
  }, [settings.theme_primary, settings.theme_accent]);

  // Real-time public Firestore subscriptions
  useEffect(() => {
    const uSettings = subscribeEventSettings(setSettings);
    const uPoster = subscribeEventPoster(setPoster);
    const uParticipants = subscribePublicParticipants(setPublicParticipants);
    return () => {
      uSettings();
      uPoster();
      uParticipants();
    };
  }, []);

  const handleRegistered = (created: ParticipantPublic) => {
    setLatestTicket(created);
    setModalTicket(created);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC] text-slate-900">
      <Navbar
        view={view}
        onSwitchView={(next) => {
          setView(next);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        hasTicket={Boolean(latestTicket)}
        onOpenTicket={() => {
          if (latestTicket) setModalTicket(latestTicket);
        }}
      />

      {view === 'public' ? (
        <main className="flex-1">
          <PosterHero poster={poster} settings={settings} />

          <RegistrationForm
            settings={settings}
            branches={AUTHORIZED_BRANCHES}
            onRegistered={handleRegistered}
          />

          <ParticipantsGallery
            participants={publicParticipants}
            visible={true}
            onSelectTicket={(p) => setModalTicket(p)}
          />
        </main>
      ) : (
        <main className="flex-1">
          <TableauDeBord
            participants={publicParticipants}
            branches={AUTHORIZED_BRANCHES}
            eventTitle={settings.titre}
            onBack={() => {
              setView('public');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </main>
      )}

      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p className="font-medium text-slate-700">
            Pyjama Party — Plateforme officielle d’inscription et de billetterie
          </p>
          <p>
            Numéros de téléphone strictement confidentiels · Inscription et suivi en temps réel
          </p>
        </div>
      </footer>

      <TicketModal
        participant={modalTicket}
        eventTitle={settings.titre}
        onClose={() => setModalTicket(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PyjamaPartyApp />
    </ErrorBoundary>
  );
}
