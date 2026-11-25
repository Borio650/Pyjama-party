import React from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ParticipantAdmin, ParticipantPublic } from '../types/pyjama';
import { formatPhoneDisplay } from './crypto';

function formatDateFr(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export async function renderQrToPngDataUrl(token: string, size = 320): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    React.createElement(QRCodeCanvas, {
      value: token,
      size,
      level: 'H',
      includeMargin: true,
      bgColor: '#FFFFFF',
      fgColor: '#0F172A',
    })
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

  const canvas = container.querySelector('canvas');
  const dataUrl = canvas ? canvas.toDataURL('image/png') : '';

  root.unmount();
  container.remove();

  if (!dataUrl) {
    throw new Error('Impossible de générer le QR Code.');
  }
  return dataUrl;
}

export async function downloadQrPng(participant: ParticipantPublic): Promise<void> {
  const dataUrl = await renderQrToPngDataUrl(participant.qr_token, 512);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `qr-${participant.numero_inscription}-${participant.nom.toLowerCase()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadTicketPdf(
  participant: ParticipantPublic,
  eventTitle: string
): Promise<void> {
  const qrDataUrl = await renderQrToPngDataUrl(participant.qr_token, 400);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TICKET OFFICIEL — PYJAMA PARTY', pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const titleLines = doc.splitTextToSize(eventTitle || 'PYJAMA PARTY', pageWidth - 24);
  doc.text(titleLines[0] || 'PYJAMA PARTY', pageWidth / 2, 23, { align: 'center' });

  // Ticket card border
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, 42, pageWidth - 24, 146, 4, 4, 'FD');

  // Registration number
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8.5);
  doc.text("NUMÉRO D'INSCRIPTION", pageWidth / 2, 52, { align: 'center' });

  doc.setTextColor(30, 27, 75);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(participant.numero_inscription, pageWidth / 2, 61, { align: 'center' });

  // QR Code centered
  const qrSize = 58;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect((pageWidth - qrSize) / 2 - 2, 67, qrSize + 4, qrSize + 4, 3, 3, 'F');
  doc.addImage(qrDataUrl, 'PNG', (pageWidth - qrSize) / 2, 69, qrSize, qrSize);

  // Participant details
  doc.setDrawColor(203, 213, 225);
  doc.line(20, 135, pageWidth - 20, 135);

  const startY = 145;
  const labelX = 20;
  const valX = 58;

  const rows: [string, string][] = [
    ['Participant', `${participant.nom.toUpperCase()} ${participant.prenom}`],
    ['Branche', participant.branche_nom],
    ['Service', participant.service_nom],
    ['Inscription', formatDateFr(participant.created_at)],
  ];

  rows.forEach(([label, val], idx) => {
    const y = startY + idx * 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, labelX, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const wrapped = doc.splitTextToSize(val, pageWidth - valX - 18);
    doc.text(wrapped[0] || val, valX, y);
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Présentez ce QR Code à l'entrée. Ce ticket est personnel et utilisable une seule fois.",
    pageWidth / 2,
    198,
    { align: 'center' }
  );

  doc.save(`ticket-${participant.numero_inscription}-${participant.nom.toLowerCase()}.pdf`);
}

export async function exportAllTicketsPdf(
  participants: ParticipantPublic[],
  eventTitle: string
): Promise<void> {
  if (participants.length === 0) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cardsPerPage = 4;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (i > 0 && i % cardsPerPage === 0) {
      doc.addPage();
    }

    const slot = i % cardsPerPage;
    const col = slot % 2;
    const row = Math.floor(slot / 2);

    const cardW = 88;
    const cardH = 126;
    const x = 14 + col * (cardW + 6);
    const y = 16 + row * (cardH + 10);

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD');

    doc.setFillColor(30, 27, 75);
    doc.rect(x, y, cardW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(eventTitle.slice(0, 34), x + cardW / 2, y + 8, { align: 'center' });
    doc.setFontSize(8);
    doc.text(p.numero_inscription, x + cardW / 2, y + 14, { align: 'center' });

    const qrUrl = await renderQrToPngDataUrl(p.qr_token, 260);
    doc.addImage(qrUrl, 'PNG', x + (cardW - 44) / 2, y + 23, 44, 44);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const fullName = `${p.nom.toUpperCase()} ${p.prenom}`;
    doc.text(doc.splitTextToSize(fullName, cardW - 12)[0] || fullName, x + cardW / 2, y + 77, {
      align: 'center',
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Branche : ${p.branche_nom}`.slice(0, 42), x + 8, y + 90);
    doc.text(`Service : ${p.service_nom}`.slice(0, 42), x + 8, y + 97);
    doc.text(
      `Statut : ${p.statut_entree ? 'Déjà entré' : 'En attente'}`,
      x + 8,
      y + 104
    );
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Ticket personnel à usage unique', x + cardW / 2, y + 119, { align: 'center' });
  }

  doc.save(`tous-les-tickets-pyjama-party.pdf`);
}

export function exportParticipantsExcel(participants: ParticipantAdmin[]): void {
  const rows = participants.map((p) => ({
    'N° Inscription': p.numero_inscription,
    Nom: p.nom,
    Prénom: p.prenom,
    Contact: formatPhoneDisplay(p.contact),
    Branche: p.branche_nom,
    Service: p.service_nom,
    "Date d'inscription": formatDateFr(p.created_at),
    "Statut d'entrée": p.statut_entree ? 'Arrivé' : 'Non arrivé',
    "Heure d'entrée": p.date_entree ? formatDateFr(p.date_entree) : '—',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 26 },
    { wch: 26 },
    { wch: 20 },
    { wch: 14 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');
  XLSX.writeFile(workbook, `participants-pyjama-party-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportParticipantsCsv(participants: ParticipantAdmin[]): void {
  const headers = [
    'N° Inscription',
    'Nom',
    'Prénom',
    'Contact',
    'Branche',
    'Service',
    "Date d'inscription",
    "Statut d'entrée",
    "Heure d'entrée",
  ];

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const lines = [
    headers.map(escapeCsv).join(';'),
    ...participants.map((p) =>
      [
        p.numero_inscription,
        p.nom,
        p.prenom,
        formatPhoneDisplay(p.contact),
        p.branche_nom,
        p.service_nom,
        formatDateFr(p.created_at),
        p.statut_entree ? 'Arrivé' : 'Non arrivé',
        p.date_entree ? formatDateFr(p.date_entree) : '—',
      ]
        .map(escapeCsv)
        .join(';')
    ),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `participants-pyjama-party-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportParticipantsPdf(
  participants: ParticipantAdmin[],
  eventTitle: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`Liste des participants — ${eventTitle}`, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Exporté le ${formatDateFr(new Date())} · Total : ${participants.length} participant(s)`,
    14,
    22
  );

  autoTable(doc, {
    startY: 27,
    head: [[
      'N°',
      'Nom',
      'Prénom',
      'Contact',
      'Branche',
      'Service',
      "Date d'inscription",
      "Statut d'entrée",
    ]],
    body: participants.map((p) => [
      p.numero_inscription,
      p.nom,
      p.prenom,
      formatPhoneDisplay(p.contact),
      p.branche_nom,
      p.service_nom,
      formatDateFr(p.created_at),
      p.statut_entree ? 'Arrivé' : 'En attente',
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [30, 27, 75],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  doc.save(`participants-pyjama-party-${new Date().toISOString().slice(0, 10)}.pdf`);
}
