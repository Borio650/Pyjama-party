import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  RotateCcw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import type { BranchItem, ParticipantPublic } from '../types/pyjama';
import {
  lookupParticipantByTokenOrCode,
  validateParticipantPresence,
} from '../lib/firestoreService';
import {
  downloadTicketPdf,
  exportPresenceCsv,
  exportPresenceExcel,
  exportPresencePdf,
} from '../lib/exportUtils';

const SCANNER_ID = 'tableau-qr-scanner';

interface TableauDeBordProps {
  token: string | null;
  onAuthenticated: (token: string) => void;
  onLock: () => void;
  participants: ParticipantPublic[];
  branches: BranchItem[];
  eventTitle: string;
}

export const TableauDeBord: React.FC<TableauDeBordProps> = ({
  token,
  onAuthenticated,
  onLock,
  participants,
  branches,
  eventTitle,
}) => {
  // Auth state
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Scanner state
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [validating, setValidating] = useState(false);
  const [scanResult, setScanResult] = useState<{
    found: boolean;
    query: string;
    participant: ParticipantPublic | null;
    justValidated?: boolean;
    alreadyScanned?: boolean;
  } | null>(null);

  // Table filters & modal
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterPresence, setFilterPresence] = useState<'all' | 'presente' | 'absente'>('all');
  const [qrInspect, setQrInspect] = useState<ParticipantPublic | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const [serverUnreachable, setServerUnreachable] = useState(false);

  const checkAuthStatus = async () => {
    setCheckingStatus(true);
    setAuthError(null);
    setServerUnreachable(false);

    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('/api/admin/auth-status', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setNeedsSetup(Boolean(data?.needsSetup));
        setCheckingStatus(false);
        return;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error('Erreur réseau');
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 450));
        }
      }
    }

    console.warn('Auth status check failed:', lastErr?.message);
    setServerUnreachable(true);
    setCheckingStatus(false);
  };

  // Check server auth status when unauthenticated
  useEffect(() => {
    if (token) return;
    void checkAuthStatus();
  }, [token]);

  const stopCamera = async () => {
    const instance = scannerRef.current;
    if (instance) {
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
        instance.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingAuth) return;
    setAuthError(null);

    if (!passcode.trim()) {
      setAuthError('Veuillez saisir le mot de passe.');
      return;
    }

    setSubmittingAuth(true);
    try {
      const endpoint = needsSetup ? '/api/admin/setup' : '/api/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        body: JSON.stringify({ passcode }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setAuthError(
          "Le serveur backend n'a pas encore répondu. Actualisez la page puis réessayez."
        );
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 412 && data?.needsSetup) {
          // Automatically claim on first run when submitting the initial passcode
          const setupRes = await fetch('/api/admin/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            credentials: 'same-origin',
            body: JSON.stringify({ passcode }),
          });
          const setupType = setupRes.headers.get('content-type') || '';
          if (!setupType.includes('application/json')) {
            setAuthError(
              "Le serveur backend n'a pas encore répondu. Actualisez la page puis réessayez."
            );
            return;
          }
          const setupData = await setupRes.json();
          if (setupRes.ok && setupData?.token) {
            setPasscode('');
            setServerUnreachable(false);
            onAuthenticated(setupData.token);
            return;
          }
          setNeedsSetup(true);
          setAuthError(setupData?.error || 'Impossible de définir le mot de passe.');
          return;
        }
        setAuthError(data?.error || 'Mot de passe incorrect.');
        return;
      }
      if (data?.token) {
        setPasscode('');
        setServerUnreachable(false);
        onAuthenticated(data.token);
      }
    } catch {
      setAuthError(
        'Connexion au serveur interrompue. Veuillez actualiser la page et réessayer.'
      );
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleLookup = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setLookingUp(true);
    setCameraError(null);
    try {
      const found = await lookupParticipantByTokenOrCode(code);
      setScanResult({
        found: Boolean(found),
        query: code,
        participant: found,
        alreadyScanned: Boolean(found?.statut_entree),
      });
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'Erreur lors de la recherche du QR Code.'
      );
    } finally {
      setLookingUp(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    await stopCamera();
    try {
      const qr = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          if (decodedText === lastScannedRef.current) return;
          lastScannedRef.current = decodedText;
          await stopCamera();
          await handleLookup(decodedText);
        },
        () => {}
      );
      setCameraActive(true);
    } catch (err) {
      scannerRef.current = null;
      setCameraActive(false);
      setCameraError(
        err instanceof Error && err.message.toLowerCase().includes('permission')
          ? "Accès à la caméra refusé. Autorisez la caméra ou saisissez le code manuellement."
          : "Caméra indisponible sur cet appareil. Utilisez la recherche manuelle ci-dessous."
      );
    }
  };

  const handleConfirmPresence = async (participantId: string) => {
    if (validating) return;
    setValidating(true);
    setCameraError(null);
    try {
      const res = await validateParticipantPresence(participantId);
      if (scanResult?.participant && scanResult.participant.id === participantId) {
        if (res.status === 'already_used') {
          setScanResult({
            ...scanResult,
            participant: {
              ...scanResult.participant,
              statut_entree: true,
              date_entree: res.dateEntree,
            },
            alreadyScanned: true,
            justValidated: false,
          });
        } else if (res.status === 'validated') {
          setScanResult({
            ...scanResult,
            participant: {
              ...scanResult.participant,
              statut_entree: true,
              date_entree: res.dateEntree ?? new Date(),
            },
            justValidated: true,
            alreadyScanned: false,
          });
        }
      }
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'Erreur lors de la validation.'
      );
    } finally {
      setValidating(false);
    }
  };

  const handleDirectMarkPresent = async (participant: ParticipantPublic) => {
    if (participant.statut_entree || markingId) return;
    setMarkingId(participant.id);
    try {
      await validateParticipantPresence(participant.id);
    } finally {
      setMarkingId(null);
    }
  };

  const resetScanner = () => {
    lastScannedRef.current = '';
    setScanResult(null);
    setManualCode('');
    setCameraError(null);
  };

  const totalCount = participants.length;
  const presentCount = useMemo(
    () => participants.filter((p) => p.statut_entree).length,
    [participants]
  );
  const absentCount = totalCount - presentCount;

  const filteredParticipants = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return participants.filter((p) => {
      if (filterBranch !== 'all' && p.branche_id !== filterBranch) return false;
      if (filterPresence === 'presente' && !p.statut_entree) return false;
      if (filterPresence === 'absente' && p.statut_entree) return false;
      if (!q) return true;
      return (
        p.nom.toLowerCase().includes(q) ||
        p.prenom.toLowerCase().includes(q) ||
        p.numero_inscription.toLowerCase().includes(q) ||
        p.branche_nom.toLowerCase().includes(q) ||
        p.service_nom.toLowerCase().includes(q)
      );
    });
  }, [participants, searchTerm, filterBranch, filterPresence]);

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

  // --- Passcode Gate ---
  if (!token) {
    return (
      <section className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div
            className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)',
              color: 'var(--brand-primary)',
            }}
          >
            <KeyRound className="w-6 h-6" aria-hidden="true" />
          </div>

          <h1 className="font-display text-2xl font-bold text-slate-900 text-center mb-2">
            {needsSetup ? 'Configurer le mot de passe' : 'Accès au Tableau de bord'}
          </h1>
          <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
            {needsSetup
              ? 'Définissez le mot de passe administrateur pour protéger l’accès à la liste des inscrits et au scanner QR Code.'
              : 'Saisissez le mot de passe administrateur pour voir toutes les personnes inscrites et scanner les QR Codes à l’entrée.'}
          </p>

          {checkingStatus ? (
            <div className="py-6 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Vérification...</span>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {serverUnreachable && !authError && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-900 flex items-start justify-between gap-3"
                >
                  <span>
                    Serveur de vérification temporairement indisponible. Actualisez la page ou réessayez.
                  </span>
                  <button
                    type="button"
                    onClick={() => void checkAuthStatus()}
                    className="inline-flex items-center gap-1 font-semibold underline shrink-0 cursor-pointer hover:text-amber-950"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Réessayer</span>
                  </button>
                </div>
              )}

              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-800"
                >
                  {authError}
                </div>
              )}

              <div>
                <label
                  htmlFor="dashboard-passcode"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="dashboard-passcode"
                    type={showPasscode ? 'text' : 'password'}
                    required
                    autoFocus
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Entrez le mot de passe"
                    className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((v) => !v)}
                    aria-label={showPasscode ? 'Masquer' : 'Afficher'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingAuth}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl text-white transition-opacity hover:opacity-95 disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {submittingAuth ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>
                  {needsSetup ? 'Enregistrer et ouvrir' : 'Accéder au Tableau de bord'}
                </span>
              </button>
            </form>
          )}
        </div>
      </section>
    );
  }

  // --- Authenticated Dashboard ---
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header + Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Tableau de bord — Contrôle des présences
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Scannez le QR Code de chaque participant pour faire passer son statut de « Absente » à « Présente ».
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void stopCamera();
            onLock();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Verrouiller</span>
        </button>
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

      {/* Scanner Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: Camera + Manual Input */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Scanner un QR Code
                </h2>
                <p className="text-xs text-slate-500">
                  Utilisez la caméra de votre téléphone ou saisissez le numéro PYJ.
                </p>
              </div>
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white shrink-0 cursor-pointer"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  <Camera className="w-4 h-4" />
                  <span>Activer caméra</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void stopCamera()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 shrink-0 cursor-pointer"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Arrêter</span>
                </button>
              )}
            </div>

            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 min-h-[230px] flex items-center justify-center">
              <div id={SCANNER_ID} className="w-full" />
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300">
                  <QrCode className="w-9 h-9 mb-2.5 text-slate-400" />
                  <p className="text-sm font-medium text-white">Caméra prête</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Appuyez sur « Activer caméra » pour scanner le QR Code d’un participant.
                  </p>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-900">
                {cameraError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleLookup(manualCode);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Saisir N° (ex. PYJ-123456) ou jeton QR"
                className="flex-1 min-h-[42px] px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-xl"
              />
              <button
                type="submit"
                disabled={lookingUp || !manualCode.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {lookingUp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Vérifier</span>
              </button>
            </form>
          </div>

          {/* Right: Scan Result */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Résultat du scan
              </h3>
              {scanResult && (
                <button
                  type="button"
                  onClick={resetScanner}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Nouveau scan</span>
                </button>
              )}
            </div>

            {!scanResult ? (
              <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/70">
                <UserCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">
                  Scannez un QR Code ou recherchez un numéro pour valider la présence d’un participant.
                </p>
              </div>
            ) : !scanResult.found || !scanResult.participant ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center space-y-1.5">
                <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
                <p className="font-display text-base font-bold text-red-900">
                  Ticket introuvable
                </p>
                <p className="text-xs text-red-800">
                  Aucun participant ne correspond à « {scanResult.query} ».
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {scanResult.justValidated ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900">
                        PRÉSENCE VALIDÉE : Présente
                      </p>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Scanné le {formatDate(scanResult.participant.date_entree)}
                      </p>
                    </div>
                  </div>
                ) : scanResult.participant.statut_entree || scanResult.alreadyScanned ? (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-900">
                        DÉJÀ SCANNÉ — Statut : Présente
                      </p>
                      <p className="text-xs text-red-800 mt-0.5">
                        Ce ticket a déjà été validé le {formatDate(scanResult.participant.date_entree)}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-900">
                        TICKET VALIDE — Statut actuel : Absente
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Appuyez ci-dessous pour enregistrer sa présence.
                      </p>
                    </div>
                  </div>
                )}

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Nom & Prénom</span>
                    <span className="font-bold text-slate-900 text-right">
                      {scanResult.participant.nom.toUpperCase()} {scanResult.participant.prenom}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">N° Inscription</span>
                    <span className="font-mono-tabular font-semibold text-slate-800">
                      {scanResult.participant.numero_inscription}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Branche</span>
                    <span className="text-slate-800 text-right">
                      {scanResult.participant.branche_nom}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Service</span>
                    <span className="text-slate-800 text-right">
                      {scanResult.participant.service_nom}
                    </span>
                  </div>
                </div>

                {!scanResult.participant.statut_entree && (
                  <button
                    type="button"
                    onClick={() => void handleConfirmPresence(scanResult.participant!.id)}
                    disabled={validating}
                    className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                  >
                    {validating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>MARQUER PRÉSENTE</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher nom, prénom, N°, service..."
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl"
            />
          </div>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
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
                            title="Voir le QR Code"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {!p.statut_entree && (
                            <button
                              type="button"
                              disabled={markingId === p.id}
                              onClick={() => void handleDirectMarkPresent(p)}
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

      {/* QR Code Modal */}
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
