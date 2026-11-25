import React, { useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { BranchItem, EventSettings, ParticipantPublic } from '../types/pyjama';
import { registerParticipant } from '../lib/firestoreService';
import { isValidPhoneNumber, normalizePhoneNumber } from '../lib/crypto';

interface RegistrationFormProps {
  settings: EventSettings;
  branches: BranchItem[];
  onRegistered: (participant: ParticipantPublic) => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  settings,
  branches,
  onRegistered,
}) => {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [contact, setContact] = useState('+225 ');
  const [brancheId, setBrancheId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePhoneChange = (val: string) => {
    if (!val.trim()) {
      setContact('+225 ');
      return;
    }
    setContact(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const cleanNom = nom.trim();
    const cleanPrenom = prenom.trim();
    const cleanService = serviceName.trim();
    const normalizedPhone = normalizePhoneNumber(contact);
    const selectedBranch = branches.find((b) => b.id === brancheId);

    if (cleanNom.length < 2) {
      setErrorMsg('Veuillez saisir votre nom (minimum 2 caractères).');
      return;
    }
    if (cleanPrenom.length < 2) {
      setErrorMsg('Veuillez saisir votre prénom (minimum 2 caractères).');
      return;
    }
    if (!isValidPhoneNumber(normalizedPhone) || normalizedPhone.length < 11) {
      setErrorMsg(
        'Veuillez saisir un numéro de téléphone valide (ex. +225 07 08 09 10 11).'
      );
      return;
    }
    if (!selectedBranch) {
      setErrorMsg('Veuillez sélectionner votre branche.');
      return;
    }
    if (cleanService.length < 2) {
      setErrorMsg('Veuillez saisir le nom de votre service (minimum 2 caractères).');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await registerParticipant({
        nom: cleanNom,
        prenom: cleanPrenom,
        contact: normalizedPhone,
        branche: selectedBranch,
        serviceName: cleanService,
      });

      setNom('');
      setPrenom('');
      setContact('+225 ');
      setBrancheId('');
      setServiceName('');
      onRegistered(created);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer votre inscription. Veuillez réessayer."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="inscription" className="py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
        <div className="mb-8">
          <h1
            className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-balance mb-3"
            style={{ color: 'var(--brand-primary)' }}
          >
            {settings.titre || 'INSCRIPTION AU PYJAMA PARTY'}
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl">
            {settings.description}
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="reg-nom"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Nom <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-nom"
                type="text"
                required
                maxLength={80}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Kouassi"
                autoComplete="family-name"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
              />
            </div>

            <div>
              <label
                htmlFor="reg-prenom"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Prénom <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-prenom"
                type="text"
                required
                maxLength={80}
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Ex. Aminata"
                autoComplete="given-name"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-contact"
              className="block text-sm font-medium text-slate-800 mb-1.5"
            >
              Contact téléphonique <span className="text-red-600">*</span>
            </label>
            <input
              id="reg-contact"
              type="tel"
              required
              maxLength={24}
              value={contact}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+225 07 08 09 10 11"
              autoComplete="tel"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Confidentiel : votre numéro n’apparaît jamais publiquement sur la liste des inscrits.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="reg-branche"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Branche <span className="text-red-600">*</span>
              </label>
              <select
                id="reg-branche"
                required
                value={brancheId}
                onChange={(e) => setBrancheId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
              >
                <option value="">Sélectionnez votre branche</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nom_branche}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reg-service"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Service <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-service"
                type="text"
                required
                maxLength={80}
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Saisissez le nom de votre service"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm sm:text-base font-semibold rounded-xl transition-opacity hover:opacity-95 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: 'var(--brand-primary-fg)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  <span>VALIDER MON INSCRIPTION</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
