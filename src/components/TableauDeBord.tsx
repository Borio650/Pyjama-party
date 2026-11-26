import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  QrCode,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import type { BranchItem, ParticipantPublic } from '../types/pyjama';
import { validateParticipantPresence } from '../lib/firestoreService';
import {
  downloadTicketPdf,
  exportPresenceCsv,
  exportPresenceExcel,
  exportPresencePdf,
} from '../lib/exportUtils';

interface TableauDeBordProps {
  participants: ParticipantPublic[];
  branches: BranchItem[];
  eventTitle: string;
  onBack?: () => void;
}

export const TableauDeBord: React.FC<TableauDeBordProps> = ({
  participants,
  branches,
  eventTitle,
  onBack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterPresence, setFilterPresence] = useState<'all' | 'presente' | 'absente'>('all');
  const [qrInspect, setQrInspect] = useState<ParticipantPublic | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastMarkedName, setLastMarkedName] = useState<string | null>(null);

  const handleMarkPresent = async (participant: ParticipantPublic) => {
    if (participant.statut_entree || markingId) return;
    setMarkingId(participant.id);
    setActionError(null);
    try {
      const res = await validateParticipantPresence(participant.id);
      if (res.status === 'validated' || res.status === 'already_used') {
        setLastMarkedName(`${participant.nom.toUpperCase()} ${participant.prenom}`);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Erreur lors de la validation de présence.'
      );
    } finally {
      setMarkingId(null);
    }
  };

  const totalCount = participants.length;
  const presentCount = useMemo(
    () => participants.filter((p) => p.statut_entree).length,
    [participants]
  );
  const absentCount = totalCount - presentCount;

  const trimmedQuery = searchTerm.trim().toLowerCase();

  // Instant search matches (ignores dropdown filters so staff always finds anyone fast)
  const instantMatches = useMemo(() => {
    if (!trimmedQuery) return [];
    return participants.filter((p) => {
      const fullName = `${p.nom} ${p.prenom}`.toLowerCase();
      const reverseName = `${p.prenom} ${p.nom}`.toLowerCase();
      return (
        fullName.includes(trimmedQuery) ||
        reverseName.includes(trimmedQuery) ||
        p.numero_inscription.toLowerCase().includes(trimmedQuery) ||
        p.branche_nom.toLowerCase().includes(trimmedQuery) ||
        p.service_nom.toLowerCase().includes(trimmedQuery)
      );
    });
  }, [participants, trimmedQuery]);

  // Complete table matches (combines search bar + branch/status filters)
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      if (filterBranch !== 'all' && p.branche_id !== filterBranch) return false;
      if (filterPresence === 'presente' && !p.statut_entree) return false;
      if (filterPresence === 'absente' && p.statut_entree) return false;
      if (!trimmedQuery) return true;
      const fullName = `${p.nom} ${p.prenom}`.toLowerCase();
      const reverseName = `${p.prenom} ${p.nom}`.toLowerCase();
      return (
        fullName.includes(trimmedQuery) ||
        reverseName.includes(trimmedQuery) ||
        p.numero_inscription.toLowerCase().includes(trimmedQuery) ||
        p.branche_nom.toLowerCase().includes(trimmedQuery) ||
        p.service_nom.toLowerCase().includes(trimmedQuery)
      );
    });
  }, [participants, trimmedQuery, filterBranch, filterPresence]);

  const formatDate = (d: Date | null) => {
    if (!d) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header + Return Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Tableau de bord — Contrôle des présences
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Recherchez un participant instantanément par son nom, prénom, numéro ou branche pour valider sa présence.
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour aux inscriptions</span>
          </button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs font-medium text-slate-500">Total inscrits</p>
          <p className="font-mono-tabular text-3xl font-bold text-slate-900 mt-1.5">
            {totalCount}
          </p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-2xl p-5">
          <p className="text-xs font-medium text-emerald-700">Présente(s)</p>
          <p className="font-mono-tabular text-3xl font-bold text-emerald-700 mt-1.5">
            {presentCount}
          </p>
        </div>
        <div className="bg-white border border-amber-200 rounded-2xl p-5">
          <p className="text-xs font-medium text-amber-700">Absente(s)</p>
          <p className="font-mono-tabular text-3xl font-bold text-amber-700 mt-1.5">
            {absentCount}
          </p>
        </div>
      </div>

      {/* Instant Search & Check-in Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Recherche instantanée des participants
            </h2>
            <p className="text-xs text-slate-500">
              Les résultats s’affichent au fur et à mesure de votre saisie pour pointer l’entrée en un clic.
            </p>
          </div>
          {trimmedQuery && (
            <span className="font-mono-tabular text-xs font-semibold text-slate-600">
              {instantMatches.length} résultat{instantMatches.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="relative">
          <Search
            className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setLastMarkedName(null);
            }}
            placeholder="Rechercher instantanément par nom, prénom, N° PYJ, branche ou service..."
            aria-label="Rechercher instantanément un participant"
            className="w-full min-h-[48px] pl-11 pr-11 py-3 text-sm sm:text-base text-slate-900 border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setLastMarkedName(null);
              }}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {actionError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-800"
          >
            {actionError}
          </div>
        )}

        {lastMarkedName && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Présence confirmée pour <strong>{lastMarkedName}</strong> — statut mis à jour sur « Présente ».
            </span>
          </div>
        )}

        {trimmedQuery ? (
          instantMatches.length === 0 ? (
            <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60">
              <p className="text-sm font-medium text-slate-700">
                Aucun participant trouvé pour « {searchTerm.trim()} ».
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {instantMatches.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.statut_entree ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Présente</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Absente</span>
                        </span>
                      )}
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {p.nom.toUpperCase()} {p.prenom}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 truncate">
                      <span className="font-mono-tabular font-semibold text-slate-700">
                        {p.numero_inscription}
                      </span>
                      {' · '}
                      {p.branche_nom} · {p.service_nom}
                    </p>
                  </div>

                  {p.statut_entree ? (
                    <span className="text-xs font-semibold text-emerald-700 shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      Validée
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={markingId === p.id}
                      onClick={() => void handleMarkPresent(p)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 shrink-0 cursor-pointer"
                    >
                      {markingId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Marquer Présente</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="py-5 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-xs sm:text-sm text-slate-500">
              Commencez à taper dans la barre ci-dessus pour trouver instantanément un participant et valider sa présence.
            </p>
          </div>
        )}
      </div>

      {/* Complete Participants List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Liste de toutes les personnes inscrites ({filteredParticipants.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Le statut « Présente » ou « Absente » s’affiche directement devant chaque nom en temps réel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportPresenceExcel(filteredParticipants)}
              disabled={filteredParticipants.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => exportPresencePdf(filteredParticipants, eventTitle)}
              disabled={filteredParticipants.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-red-700" />
              <span>PDF (.pdf)</span>
            </button>
            <button
              type="button"
              onClick={() => exportPresenceCsv(filteredParticipants)}
              disabled={filteredParticipants.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-700" />
              <span>CSV (.csv)</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            aria-label="Filtrer par branche"
            className="w-full min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
          >
            <option value="all">Toutes les branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nom_branche}
              </option>
            ))}
          </select>

          <select
            value={filterPresence}
            onChange={(e) =>
              setFilterPresence(e.target.value as 'all' | 'presente' | 'absente')
            }
            aria-label="Filtrer par statut de présence"
            className="w-full min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
          >
            <option value="all">Tous les statuts</option>
            <option value="presente">Présente uniquement</option>
            <option value="absente">Absente uniquement</option>
          </select>
        </div>

        {/* Table: Présence column directly in front of Nom & Prénom */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Présence</th>
                  <th className="py-3 px-4 whitespace-nowrap">Nom & Prénom</th>
                  <th className="py-3 px-4 whitespace-nowrap">N°</th>
                  <th className="py-3 px-4 whitespace-nowrap">Branche</th>
                  <th className="py-3 px-4 whitespace-nowrap">Service</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date d’inscription</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      Aucun participant trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 whitespace-nowrap">
                        {p.statut_entree ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>Présente</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                            <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>Absente</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {p.nom.toUpperCase()} {p.prenom}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {p.numero_inscription}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {p.branche_nom}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {p.service_nom}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setQrInspect(p)}
                            title="Voir le ticket"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {!p.statut_entree && (
                            <button
                              type="button"
                              disabled={markingId === p.id}
                              onClick={() => void handleMarkPresent(p)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                            >
                              {markingId === p.id ? '...' : 'Valider'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ticket Modal */}
      {qrInspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 text-center relative">
            <button
              type="button"
              onClick={() => setQrInspect(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="font-mono-tabular text-sm font-bold text-slate-900 mb-3">
              {qrInspect.numero_inscription}
            </p>
            <div className="inline-flex p-3 bg-white border border-slate-200 rounded-xl mb-3">
              <QRCodeSVG value={qrInspect.qr_token} size={180} level="H" />
            </div>
            <p className="font-display font-bold text-slate-900">
              {qrInspect.nom.toUpperCase()} {qrInspect.prenom}
            </p>
            <p className="text-xs text-slate-600 mt-1 mb-4">
              {qrInspect.branche_nom} · {qrInspect.service_nom}
            </p>
            <button
              type="button"
              onClick={() => void downloadTicketPdf(qrInspect, eventTitle)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white cursor-pointer"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le ticket PDF</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
