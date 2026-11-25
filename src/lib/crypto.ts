const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateSecureId(length = 24): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  }
  return out;
}

export function generateQrToken(): string {
  return `pyj_${generateSecureId(32)}`;
}

export function generateRegistrationNumber(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const digits = String(num % 900000 + 100000);
  return `PYJ-${digits}`;
}

export function normalizePhoneNumber(raw: string): string {
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00')) {
    return `+${cleaned.slice(2).replace(/\D/g, '')}`;
  }
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }
  const digits = cleaned.replace(/\D/g, '');
  if (digits.startsWith('225')) {
    return `+${digits}`;
  }
  return `+225${digits}`;
}

export function isValidPhoneNumber(normalized: string): boolean {
  return /^\+[0-9]{8,18}$/.test(normalized);
}

export function formatPhoneDisplay(contact: string): string {
  if (!contact.startsWith('+225')) return contact;
  const rest = contact.slice(4);
  const grouped = rest.match(/.{1,2}/g)?.join(' ') ?? rest;
  return `+225 ${grouped}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function slugifyId(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `item-${generateSecureId(6).toLowerCase()}`;
}
