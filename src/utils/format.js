/** Formateadores de tamaño, fechas y porcentajes. */

export function formatBytes(bytes, decimals = 1) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : decimals)} ${units[i - 1]}`;
}

export function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function formatPercent(value) {
  return `${Math.round(clampPercent(value))}%`;
}

export function readingTimeMinutes(wordCount) {
  if (!wordCount) return 0;
  // Velocidad de lectura promedio: ~220 palabras/minuto
  return Math.max(1, Math.round(wordCount / 220));
}

export function truncate(text, max = 80) {
  if (!text) return '';
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
