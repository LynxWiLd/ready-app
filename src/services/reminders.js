import { getAllBooks } from './db.js';
import { notificationPermission, showNotification } from './notifications.js';

/**
 * Recordatorios de lectura.
 *
 * Ready es local-first y no tiene servidor de push, así que el aviso se apoya
 * en dos mecanismos:
 *  - primer plano: al abrir o volver a la app, `maybeNotifyReminder()` decide
 *    si toca avisar;
 *  - segundo plano (Android/Chrome con la PWA instalada): Periodic Background
 *    Sync despierta al service worker, que lee el snapshot guardado en Cache
 *    Storage y muestra la notificación. iOS no permite despertar apps cerradas
 *    sin un servidor, así que allí el aviso llega al abrir la app.
 *
 * El snapshot (libro en curso, hora configurada y último aviso) vive en Cache
 * Storage porque es el único almacenamiento que comparten página y SW.
 */

export const REMINDERS_KEY = 'ready.reminders';
export const DEFAULT_REMINDERS = { enabled: false, hour: 20, lastNotifiedAt: 0 };
export const REMINDER_CACHE = 'ready-reminder';
export const REMINDER_CACHE_KEY = '/__ready/reminder.json';
export const REMINDER_TAG = 'ready-reminder';
export const SNAPSHOT_VERSION = 1;

// Evita leer IndexedDB en cada guardado de progreso (cada 400 ms al leer).
const SYNC_THROTTLE_MS = 5000;
let syncTimer = null;
let pendingSync = false;

export function loadReminderSettings() {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_REMINDERS,
      ...parsed,
      hour: clampHour(parsed.hour)
    };
  } catch {
    return { ...DEFAULT_REMINDERS };
  }
}

export function saveReminderSettings(patch) {
  const next = { ...loadReminderSettings(), ...patch };
  next.hour = clampHour(next.hour);
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible */
  }
  return next;
}

function clampHour(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_REMINDERS.hour;
  return Math.min(23, Math.max(0, Math.round(n)));
}

export function sameLocalDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function cacheAvailable() {
  return typeof caches !== 'undefined';
}

export async function readReminderSnapshot() {
  if (!cacheAvailable()) return null;
  try {
    const cache = await caches.open(REMINDER_CACHE);
    const response = await cache.match(REMINDER_CACHE_KEY);
    if (!response) return null;
    const data = await response.json();
    if (data?.version !== SNAPSHOT_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeReminderSnapshot(snapshot) {
  if (!cacheAvailable()) return false;
  try {
    const cache = await caches.open(REMINDER_CACHE);
    const body = JSON.stringify({ ...snapshot, version: SNAPSHOT_VERSION });
    await cache.put(
      REMINDER_CACHE_KEY,
      new Response(body, { headers: { 'Content-Type': 'application/json' } })
    );
    return true;
  } catch {
    return false;
  }
}

/** Libro que se está leyendo: el más reciente con progreso parcial. */
export function pickReminderBook(books = []) {
  const candidates = books
    .filter((b) => Number(b.progress) > 0 && Number(b.progress) < 100)
    .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  const book = candidates[0];
  if (!book) return null;
  return {
    id: book.id,
    title: book.title,
    format: book.format,
    percent: Math.round(book.progress || 0),
    lastOpenedAt: book.lastOpenedAt || 0
  };
}

/**
 * Recalcula y guarda el snapshot que leerá el service worker.
 * @param {{books?: Array}} [options] libros ya cargados, para no releer IndexedDB
 */
export async function syncReminderSnapshot(options = {}) {
  const settings = loadReminderSettings();
  const previous = await readReminderSnapshot();
  let books = options.books;

  if (!books) {
    try {
      books = await getAllBooks();
    } catch {
      books = [];
    }
  }

  const book = pickReminderBook(books);
  const snapshot = {
    version: SNAPSHOT_VERSION,
    enabled: settings.enabled,
    hour: settings.hour,
    book,
    // Se conserva para no repetir el aviso del día si la página y el SW
    // compiten por escribir el snapshot.
    lastNotifiedAt: previous?.lastNotifiedAt || settings.lastNotifiedAt || 0,
    savedAt: Date.now()
  };

  await writeReminderSnapshot(snapshot);
  return snapshot;
}

/** Sincroniza como mucho una vez cada pocos segundos. */
export function scheduleReminderSync(delay = SYNC_THROTTLE_MS) {
  pendingSync = true;
  if (syncTimer) return;
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    if (!pendingSync) return;
    pendingSync = false;
    await syncReminderSnapshot();
  }, delay);
}

/** Sincroniza ya (cambios de ajustes o al cargar la biblioteca). */
export async function flushReminderSync() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  pendingSync = false;
  return syncReminderSnapshot();
}

/**
 * Decide si toca avisar ahora mismo y lanza la notificación.
 * @returns {Promise<{sent: boolean, reason: string}>}
 */
export async function maybeNotifyReminder() {
  const settings = loadReminderSettings();
  if (!settings.enabled) return { sent: false, reason: 'disabled' };

  const permission = notificationPermission();
  if (permission !== 'granted') return { sent: false, reason: 'permission' };

  const snapshot = await syncReminderSnapshot();
  const book = snapshot?.book;
  if (!book) return { sent: false, reason: 'no-book' };

  const now = Date.now();
  if (new Date(now).getHours() < settings.hour) return { sent: false, reason: 'too-early' };
  if (sameLocalDay(now, snapshot.lastNotifiedAt)) return { sent: false, reason: 'already' };
  // Si ya leyó hoy, no hace falta empujarle.
  if (sameLocalDay(now, book.lastOpenedAt)) return { sent: false, reason: 'read-today' };

  const sent = await showNotification(`Continúa «${book.title}»`, {
    body: `Vas por el ${book.percent} %. Te espera donde lo dejaste.`,
    tag: REMINDER_TAG,
    renotify: false,
    data: { url: `#/read/${book.id}`, bookId: book.id }
  });

  if (sent) {
    const lastNotifiedAt = now;
    await writeReminderSnapshot({ ...snapshot, lastNotifiedAt });
    saveReminderSettings({ lastNotifiedAt });
  }
  return { sent, reason: sent ? 'sent' : 'not-shown' };
}

/**
 * Registra Periodic Background Sync donde exista (Chrome/Android con la PWA
 * instalada). Es best-effort: el navegador decide cuándo despertar al SW.
 */
export async function registerPeriodicReminder() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !('periodicSync' in reg)) return false;
    await reg.periodicSync.register(REMINDER_TAG, {
      minInterval: 12 * 60 * 60 * 1000
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterPeriodicReminder() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !('periodicSync' in reg)) return false;
    await reg.periodicSync.unregister(REMINDER_TAG);
    return true;
  } catch {
    return false;
  }
}

export async function sendTestReminder() {
  return showNotification('Ready', {
    body: 'Así se verá tu recordatorio para continuar leyendo.',
    tag: 'ready-reminder-test',
    data: { url: '#/' }
  });
}
