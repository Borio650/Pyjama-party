import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Download, Image as ImageIcon, X } from 'lucide-react';
import type { ParticipantPublic } from '../types/pyjama';
import { downloadQrPng, downloadTicketPdf } from '../lib/exportUtils';

interface TicketModalProps {
  participant: ParticipantPublic | null;
  eventTitle: string;
  onClose: () => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  participant,
  eventTitle,
  onClose,
}) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);

  if (!participant) return null;

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadTicketPdf(participant, eventTitle);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadPng = async () => {
    setDownloadingPng(true);
    try {
      await downloadQrPng(participant);
    } finally {
      setDownloadingPng(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-confirm-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fenêtre"
          className="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-lg flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Confirmation Header */}
        <div
          className="px-6 py-6 text-center"
          style={{
            backgroundColor: 'var(--brand-primary)',
            color: 'var(--brand-primary-fg)',
          }}
        >
          <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-white/15 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 id="ticket-confirm-title" className="font-display text-base sm:text-lg font-bold tracking-tight text-balance">
            FÉLICITATIONS ! VOTRE INSCRIPTION AU PYJAMA PARTY EST CONFIRMÉE.
          </h2>
        </div>

        {/* Digital Ticket Card */}
        <div className="p-6">
          <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-5 text-center">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Numéro d’inscription
            </p>
            <p
              className="font-mono-tabular text-xl font-bold mb-4"
              style={{ color: 'var(--brand-primary)' }}
            >
              {participant.numero_inscription}
            </p>

            <div className="inline-flex p-3 bg-white rounded-xl border border-slate-200 mb-4">
              <QRCodeSVG
                value={participant.qr_token}
                size={168}
                level="H"
                includeMargin={false}
                bgColor="#FFFFFF"
                fgColor="#0F172A"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 text-left space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Participant</span>
                <span className="font-semibold text-slate-900 text-right">
                  {participant.nom.toUpperCase()} {participant.prenom}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Branche</span>
                <span className="font-medium text-slate-800 text-right">
                  {participant.branche_nom}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Service</span>
                <span className="font-medium text-slate-800 text-right">
                  {participant.service_nom}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl transition-opacity hover:opacity-95 disabled:opacity-60 cursor-pointer"
              style={{
                backgroundColor: 'var(--brand-accent)',
                color: 'var(--brand-accent-fg)',
              }}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>
                {downloadingPdf ? 'Génération du PDF...' : 'TÉLÉCHARGER MON TICKET'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloadingPng}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" aria-hidden="true" />
              <span>
                {downloadingPng ? 'Préparation...' : 'Sauvegarder le QR Code (PNG)'}
              </span>
            </button>
          </div>

          <p className="mt-4 text-xs text-center text-slate-500">
            Ce QR Code contient uniquement un jeton sécurisé à usage unique pour l’entrée.
          </p>
        </div>
      </div>
    </div>
  );
};
