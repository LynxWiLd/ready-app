import { test, expect } from '@playwright/test';
import { importFiles, waitForLibrary } from './helpers.js';

test('presenta los permisos la primera vez como app instalada', async ({ page }) => {
  // Emula el arranque como PWA (Safari expone navigator.standalone).
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    localStorage.removeItem('ready.permissions.intro');
  });

  await page.goto('/');
  await waitForLibrary(page);

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Permisos de Ready')).toBeVisible();
  await expect(dialog.getByText('Notificaciones', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Archivos del dispositivo')).toBeVisible();

  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('ready.permissions.intro')))
    .toBe('1');

  await page.reload();
  await waitForLibrary(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('activa recordatorios y muestra los permisos del dispositivo', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await importFiles(page, ['sample.txt']);

  await page.getByRole('button', { name: 'Ajustes' }).click();
  let dialog = page.getByRole('dialog');

  await dialog.getByRole('switch', { name: 'Activar recordatorios de lectura' }).click();
  await expect(dialog.getByText(/Notificaciones: Permitido/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Probar' })).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('ready.reminders'))?.enabled ?? false;
        } catch {
          return false;
        }
      })
    )
    .toBe(true);

  // El snapshot que lee el service worker queda en Cache Storage.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const cache = await caches.open('ready-reminder');
        const response = await cache.match('/__ready/reminder.json');
        if (!response) return null;
        const data = await response.json();
        return data.enabled;
      })
    )
    .toBe(true);

  await dialog.getByRole('button', { name: 'Permisos del dispositivo' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Permisos del dispositivo', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Notificaciones', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Almacenamiento permanente')).toBeVisible();
  await expect(dialog.getByText('Archivos del dispositivo')).toBeVisible();
  await expect(dialog.getByText('Concedido al elegir')).toBeVisible();

  await dialog.locator('button.btn-outline', { hasText: 'Cerrar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
