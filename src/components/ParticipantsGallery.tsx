import React, { useState } from 'react';
import { ChevronDown, Ticket, Users } from 'lucide-react';
import type { ParticipantPublic } from '../types/pyjama';

interface ParticipantsGalleryProps {
  participants: ParticipantPublic[];
  visible: boolean;
  onSelectTicket: (participant: ParticipantPublic) => void;
}

const PAGE_SIZE = 12;

export const ParticipantsGallery: React.FC<ParticipantsGalleryProps> = ({
  participants,
  visible,
  onSelectTicket,
}) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!visible) {
    return null;
  }

  const displayed = participants.slice(0, visibleCount);
  const hasMore = participants.length > visibleCount;

  return (
    <section id="participants" className="py-10 sm:py-14 px-4 sm:px-6 border-t border-slate-200/80 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: 'var(--brand-primary)' }}
            >
              ILS SONT DÉJÀ INSCRITS !
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Liste mise à jour en temps réel dans l’ordre chronologique des inscriptions.
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700 shrink-0">
            <Users className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span className="font-mono-tabular font-semibold text-slate-900">
              {participants.length}
            </span>
            <span>
              {participants.length > 1 ? 'participants inscrits' : 'participant inscrit'}
            </span>
          </div>
        </div>

        {participants.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-10 text-center">
            <p className="text-sm text-slate-600">
              Aucune inscription enregistrée pour le moment. Soyez le premier à valider votre place ci-dessus.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {displayed.map((p, index) => (
                <article
                  key={p.id}
                  onClick={() => onSelectTicket(p)}
                  className="group bg-[#F9FAFC] hover:bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular mb-1">
                      <span>#{String(index + 1).padStart(2, '0')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-700">{p.numero_inscription}</span>
                    </div>

                    <h3 className="font-display text-base font-semibold text-slate-900 truncate">
                      {p.nom.toUpperCase()} {p.prenom}
                    </h3>

                    <div className="mt-1.5 text-xs text-slate-600 leading-relaxed truncate">
                      <span>{p.branche_nom}</span>
                      <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                      <span>{p.service_nom}</span>
                    </div>
                  </div>

                  <div className="shrink-0 w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-slate-900 transition-colors">
                    <Ticket className="w-4 h-4" aria-hidden="true" />
                  </div>
                </article>
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>
                    Voir plus ({participants.length - visibleCount} restant
                    {participants.length - visibleCount > 1 ? 's' : ''})
                  </span>
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
