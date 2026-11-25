import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  EventPoster,
  EventSettings,
  PosterFit,
  PosterPosition,
} from '../types/pyjama';
import { processPosterFile, type ProcessedPoster } from '../lib/imageUtils';
import {
  deleteOfficialPoster,
  saveOfficialPoster,
  updatePosterDisplaySettings,
} from '../lib/firestoreService';

interface PosterHeroProps {
  poster: EventPoster | null;
  settings: EventSettings;
}

export const PosterHero: React.FC<PosterHeroProps> = ({ poster, settings }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftPoster, setDraftPoster] = useState<ProcessedPoster | null>(null);
  const [draftFit, setDraftFit] = useState<PosterFit>(settings.affiche_fit);
  const [draftPosition, setDraftPosition] = useState<PosterPosition>(
    settings.affiche_position
  );
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openEditor = () => {
    setDraftPoster(null);
    setDraftFit(settings.affiche_fit);
    setDraftPosition(settings.affiche_position);
    setErrorMsg(null);
    setEditorOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    setErrorMsg(null);
    try {
      const processed = await processPosterFile(file);
      setDraftPoster(processed);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Impossible de traiter cette image."
      );
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      if (draftPoster) {
        await saveOfficialPoster(
          {
            data_url: draftPoster.data_url,
            mime_type: draftPoster.mime_type,
            file_name: draftPoster.file_name,
            width: draftPoster.width,
            height: draftPoster.height,
          },
          {
            ...settings,
            affiche_present: true,
            affiche_fit: draftFit,
            affiche_position: draftPosition,
            theme_primary: draftPoster.theme_primary,
            theme_accent: draftPoster.theme_accent,
          }
        );
      } else {
        await updatePosterDisplaySettings({
          ...settings,
          affiche_present: Boolean(poster?.data_url),
          affiche_fit: draftFit,
          affiche_position: draftPosition,
        });
      }
      setEditorOpen(false);
      setDraftPoster(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await deleteOfficialPoster({
        ...settings,
        affiche_present: false,
        affiche_fit: 'contain',
        affiche_position: 'center',
      });
      setDraftPoster(null);
      setEditorOpen(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Erreur lors de la suppression."
      );
    } finally {
      setSaving(false);
    }
  };

  const positionClass =
    settings.affiche_position === 'top'
      ? 'object-top'
      : settings.affiche_position === 'bottom'
        ? 'object-bottom'
        : 'object-center';

  const previewUrl = draftPoster?.data_url || poster?.data_url || '';
  const previewPosClass =
    draftPosition === 'top'
      ? 'object-top'
      : draftPosition === 'bottom'
        ? 'object-bottom'
        : 'object-center';

  return (
    <section id="affiche" className="pt-6 sm:pt-10 pb-4 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {poster && poster.data_url ? (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
            <div className="w-full flex items-center justify-center bg-slate-950">
              <img
                src={poster.data_url}
                alt={`Affiche officielle — ${settings.titre}`}
                referrerPolicy="no-referrer"
                className={`w-full ${
                  settings.affiche_fit === 'cover'
                    ? `h-[340px] sm:h-[480px] md:h-[560px] object-cover ${positionClass}`
                    : 'max-h-[75vh] w-auto max-w-full object-contain mx-auto'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={openEditor}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900/80 text-white hover:bg-slate-900 backdrop-blur-sm border border-white/15 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Modifier l’affiche</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 sm:py-16 text-center">
            <div
              className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--brand-primary) 8%, transparent)',
                color: 'var(--brand-primary)',
              }}
            >
              <Sparkles className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900 mb-2">
              Espace réservé à l’affiche officielle du Pyjama Party
            </h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Importez votre affiche officielle (JPG, JPEG, PNG ou WEBP) depuis votre téléphone ou votre ordinateur. Elle s’adaptera automatiquement aux écrans mobiles et ordinateurs sans aucune déformation.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={openEditor}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-opacity hover:opacity-95 cursor-pointer"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>Importer l’affiche officielle</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inline Poster Management Modal (No login required) */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="poster-editor-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 my-auto space-y-5 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3
                  id="poster-editor-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Affiche officielle du Pyjama Party
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Formats acceptés : JPG, JPEG, PNG et WEBP. Prévisualisez et ajustez avant publication.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                aria-label="Fermer"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-800">
                {errorMsg}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 cursor-pointer"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : previewUrl ? (
                  <RefreshCw className="w-4 h-4" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>
                  {previewUrl ? 'Remplacer l’image' : 'Choisir une image'}
                </span>
              </button>

              {poster?.data_url && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer l’affiche</span>
                </button>
              )}
            </div>

            {previewUrl ? (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Prévisualisation de l'affiche"
                    referrerPolicy="no-referrer"
                    className={`w-full ${
                      draftFit === 'cover'
                        ? `h-[260px] sm:h-[320px] object-cover ${previewPosClass}`
                        : 'max-h-[340px] w-auto max-w-full object-contain mx-auto'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Ajustement sans déformation
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftFit('contain')}
                        className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl border cursor-pointer ${
                          draftFit === 'contain'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Affiche entière
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftFit('cover')}
                        className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl border cursor-pointer ${
                          draftFit === 'cover'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Bannière (Recadrer)
                      </button>
                    </div>
                  </div>

                  {draftFit === 'cover' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Alignement vertical
                      </label>
                      <div className="flex gap-2">
                        {(['top', 'center', 'bottom'] as PosterPosition[]).map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setDraftPosition(pos)}
                            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl border cursor-pointer ${
                              draftPosition === pos
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            {pos === 'top' ? 'Haut' : pos === 'center' ? 'Centre' : 'Bas'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-300 rounded-xl p-10 text-center bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer"
              >
                <ImagePlus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-800">
                  Sélectionner une affiche (JPG, PNG ou WEBP)
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || (!draftPoster && !poster?.data_url)}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor:
                    draftPoster?.theme_primary || 'var(--brand-primary)',
                }}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Publier l’affiche</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
