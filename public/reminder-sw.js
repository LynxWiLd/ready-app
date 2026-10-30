/* eslint-env serviceworker */
/**
 * Lógica de recordatorios dentro del service worker.
 *
 * vite-plugin-pwa lo inyecta con `workbox.importScripts`, así corre en el mismo
 * scope que el SW generado. Debe ser JS clásico (sin imports) y no puede usar
 * localStorage: el estado compartido con la página es Cache Storage.
 *
 * Mantener las condiciones sincronizadas con src/services/reminders.js.
 */

const REMINDER_CACHE = 'ready-reminder';
const REMINDER_KEY = '/__ready/reminder.json';
const REMINDER_TAG = 'ready-reminder';

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function readSnapshot() {
  try {
    const cache = await caches.open(REMINDER_CACHE);
    const response = await cache.match(REMINDER_KEY);
    if (!response) return null;
    const data = await response.json();
    return data && data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

async function writeSnapshot(snapshot) {
  try {
    const cache = await caches.open(REMINDER_CACHE);
    await cache.put(
      REMINDER_KEY,
      new Response(JSON.stringify(snapshot), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch {
    /* cache no disponible */
  }
}

function sameLocalDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function iconUrl() {
  return new URL('favicon.svg', self.registration.scope).href;
}

async function checkReminder() {
  const snapshot = await readSnapshot();
  if (!snapshot || !snapshot.enabled || !snapshot.book) return;

  const now = Date.now();
  if (new Date(now).getHours() < snapshot.hour) return;
  if (sameLocalDay(now, snapshot.lastNotifiedAt)) return;
  if (sameLocalDay(now, snapshot.book.lastOpenedAt)) return;

  const book = snapshot.book;
  try {
    await self.registration.showNotification(`Continúa «${book.title}»`, {
      body: `Vas por el ${book.percent} %. Te espera donde lo dejaste.`,
      icon: iconUrl(),
      badge: iconUrl(),
      lang: 'es',
      tag: REMINDER_TAG,
      data: { url: `#/read/${book.id}`, bookId: book.id }
    });
  } catch {
    return;
  }

  await writeSnapshot({ ...snapshot, lastNotifiedAt: now });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === REMINDER_TAG) {
    event.waitUntil(checkReminder());
  }
});

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  const target = new URL(data.url || '#/', self.registration.scope).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target);
            } catch {
              /* el cliente pudo cerrarse entre focus y navigate */
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })()
  );
});
