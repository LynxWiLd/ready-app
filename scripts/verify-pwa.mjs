/**
 * Verificación de PWA en producción (no funciona contra el servidor de dev,
 * porque en dev no se registra el service worker).
 *
 * Comprueba:
 *  1. El recordatorio de lectura: progreso, enlace al libro y snapshot en caché.
 *  2. El aviso de nueva versión: un despliegue nuevo muestra el banner y
 *     «Actualizar» recarga con los assets nuevos.
 *
 * Uso: `npm run test:pwa` (compila, arranca `vite preview` y limpia al salir).
 */
import { chromium } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PORT = 4179;
const BASE = `http://localhost:${PORT}`;

const log = (...args) => console.log('[pwa]', ...args);
const ok = (message) => console.log('[pwa] ok:', message);

function assert(condition, message) {
  if (!condition) throw new Error(`Fallo: ${message}`);
  ok(message);
}

async function waitForServer(url, attempts = 120) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* todavía arrancando */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`El servidor de preview no respondió en ${url}`);
}

function stopServer(child) {
  if (!child || child.killed) return;
  try {
    child.kill();
  } catch {
    /* ya estaba detenido */
  }
}

if (!existsSync('.test-files/sample.txt')) {
  log('generando fixtures…');
  execSync('node scripts/make-test-files.mjs .test-files', { stdio: 'inherit' });
}

log('compilando…');
execSync('npm run build', { stdio: 'ignore' });

log(`arrancando preview en ${BASE}…`);
// Node directamente contra el CLI de Vite: evita shells y procesos huérfanos.
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' }
);

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ channel: 'chromium' });

  // ------------------------------------------------------------ recordatorios
  {
    const context = await browser.newContext();
    await context.grantPermissions(['notifications'], { origin: BASE });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(BASE);
    await page.getByText('Tu biblioteca está vacía').waitFor();
    await page.locator('#library-picker').setInputFiles('.test-files/sample.txt');
    await page.locator('article.card').first().waitFor({ timeout: 20_000 });

    // Progreso parcial y última lectura ayer: el recordatorio debe dispararse.
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const open = indexedDB.open('ready-app');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('books', 'readwrite');
          const store = tx.objectStore('books');
          const all = store.getAll();
          all.onsuccess = () => {
            const book = all.result[0];
            book.progress = 42;
            book.lastOpenedAt = Date.now() - 36 * 60 * 60 * 1000;
            store.put(book);
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
      localStorage.setItem(
        'ready.reminders',
        JSON.stringify({ enabled: true, hour: 0, lastNotifiedAt: 0 })
      );
      ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
        window.__notified = { title, options };
        return Promise.resolve();
      };
    });

    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => window.__notified, null, { timeout: 10_000 });

    const notified = await page.evaluate(() => window.__notified);
    log('notificación:', JSON.stringify(notified));
    assert(notified.title.includes('Continúa'), 'el recordatorio invita a continuar el libro');
    assert(notified.options.body.includes('42 %'), 'el recordatorio incluye el progreso');
    assert(notified.options.data.url.startsWith('#/read/'), 'el clic abre el libro');

    const snapshot = await page.evaluate(async () => {
      const cache = await caches.open('ready-reminder');
      const res = await cache.match('/__ready/reminder.json');
      return res.json();
    });
    assert(snapshot.enabled && snapshot.lastNotifiedAt > 0, 'el snapshot queda marcado como enviado');
    assert(errors.length === 0, `sin errores de consola${errors.length ? `: ${errors.join(', ')}` : ''}`);
    await context.close();
  }

  // ------------------------------------------------------------ actualización
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE);
    await page.getByText('Tu biblioteca está vacía').waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 });

    const before = await page.evaluate(() => document.querySelector('script[type=module]')?.src);
    log('versión actual:', path.basename(before || ''));

    log('recompilando para simular un despliegue…');
    execSync('npm run build', { stdio: 'ignore' });

    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Buscar actualización' }).click();
    await page.getByText('Hay una versión nueva de Ready').waitFor({ timeout: 60_000 });
    ok('aparece el aviso de nueva versión');

    const load = page.waitForEvent('load', { timeout: 60_000 }).catch(() => null);
    await page.getByRole('button', { name: 'Actualizar' }).click();
    await load;
    await page.waitForTimeout(3000);

    const after = await page.evaluate(() => document.querySelector('script[type=module]')?.src);
    log('versión tras actualizar:', path.basename(after || ''));
    assert(after && after !== before, 'la página recarga con los assets nuevos');
    assert(
      (await page.getByText('Hay una versión nueva de Ready').count()) === 0,
      'el aviso desaparece tras actualizar'
    );
    const stillWaiting = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg?.waiting;
    });
    assert(!stillWaiting, 'no queda un service worker esperando');
    await context.close();
  }

  log('todo correcto');
} finally {
  await browser?.close().catch(() => {});
  stopServer(server);
}
