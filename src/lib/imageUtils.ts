export interface ProcessedPoster {
  data_url: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  file_name: string;
  width: number;
  height: number;
  theme_primary: string;
  theme_accent: string;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_DATA_URL_LENGTH = 680000;

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

export function getContrastTextColor(hex: string): '#FFFFFF' | '#0F172A' {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#FFFFFF';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = getLuminance(r, g, b);
  return lum > 0.42 ? '#0F172A' : '#FFFFFF';
}

function extractDominantColors(canvas: HTMLCanvasElement): { primary: string; accent: string } {
  const sampleCanvas = document.createElement('canvas');
  const size = 64;
  sampleCanvas.width = size;
  sampleCanvas.height = size;
  const ctx = sampleCanvas.getContext('2d');
  if (!ctx) {
    return { primary: '#1E1B4B', accent: '#D97706' };
  }
  ctx.drawImage(canvas, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 180) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const qr = Math.floor(r / 24) * 24;
    const qg = Math.floor(g / 24) * 24;
    const qb = Math.floor(b / 24) * 24;
    const key = `${qr},${qg},${qb}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const palette = Array.from(buckets.values())
    .map((bucket) => {
      const r = bucket.r / bucket.count;
      const g = bucket.g / bucket.count;
      const b = bucket.b / bucket.count;
      return {
        r,
        g,
        b,
        count: bucket.count,
        lum: getLuminance(r, g, b),
        sat: getSaturation(r, g, b),
      };
    })
    .sort((a, b) => b.count - a.count);

  // Pick a deep/rich primary suitable for buttons and headings (luminance <= 0.35)
  const richDark =
    palette.find((c) => c.lum >= 0.02 && c.lum <= 0.32 && c.sat >= 0.15) ||
    palette.find((c) => c.lum <= 0.38) ||
    { r: 30, g: 27, b: 75, lum: 0.03, sat: 0.5, count: 1 };

  // Pick a distinct vibrant accent
  const vibrant =
    palette.find((c) => {
      const dist = Math.hypot(c.r - richDark.r, c.g - richDark.g, c.b - richDark.b);
      return dist > 75 && c.sat >= 0.32 && c.lum >= 0.12 && c.lum <= 0.65;
    }) ||
    palette.find((c) => {
      const dist = Math.hypot(c.r - richDark.r, c.g - richDark.g, c.b - richDark.b);
      return dist > 60 && c.lum >= 0.12 && c.lum <= 0.68;
    }) ||
    { r: 217, g: 119, b: 6, lum: 0.25, sat: 0.9, count: 1 };

  return {
    primary: rgbToHex(richDark.r, richDark.g, richDark.b),
    accent: rgbToHex(vibrant.r, vibrant.g, vibrant.b),
  };
}

export async function processPosterFile(file: File): Promise<ProcessedPoster> {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const validExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

  if (!ALLOWED_TYPES.has(mime) && !validExt) {
    throw new Error('Format non supporté. Veuillez choisir une image JPG, JPEG, PNG ou WEBP.');
  }

  const imageBitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire l'image sélectionnée."));
    };
    img.src = url;
  });

  const naturalWidth = imageBitmap.naturalWidth || 1200;
  const naturalHeight = imageBitmap.naturalHeight || 800;

  let maxDim = 1600;
  let quality = 0.88;
  let targetMime: 'image/webp' | 'image/jpeg' = 'image/webp';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Erreur de traitement graphique du navigateur.');
  }

  const renderAtScale = (limit: number, q: number, outputMime: 'image/webp' | 'image/jpeg'): string => {
    const scale = Math.min(1, limit / Math.max(naturalWidth, naturalHeight));
    const w = Math.max(1, Math.round(naturalWidth * scale));
    const h = Math.max(1, Math.round(naturalHeight * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imageBitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL(outputMime, q);
    return dataUrl;
  };

  let dataUrl = renderAtScale(maxDim, quality, targetMime);
  if (!dataUrl.startsWith('data:image/webp')) {
    targetMime = 'image/jpeg';
    dataUrl = renderAtScale(maxDim, quality, targetMime);
  }

  while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.48) {
    quality -= 0.1;
    dataUrl = renderAtScale(maxDim, quality, targetMime);
  }

  while (dataUrl.length > MAX_DATA_URL_LENGTH && maxDim > 720) {
    maxDim = Math.round(maxDim * 0.8);
    dataUrl = renderAtScale(maxDim, quality, targetMime);
  }

  if (dataUrl.length > 740000) {
    throw new Error("L'affiche est trop volumineuse après compression. Veuillez choisir une image plus légère.");
  }

  const { primary, accent } = extractDominantColors(canvas);

  return {
    data_url: dataUrl,
    mime_type: targetMime,
    file_name: file.name.slice(0, 160),
    width: canvas.width,
    height: canvas.height,
    theme_primary: primary,
    theme_accent: accent,
  };
}
