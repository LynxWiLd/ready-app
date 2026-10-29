import { test, expect } from '@playwright/test';
import { importFiles, openBook } from './helpers.js';

test('la búsqueda interna y los marcadores siguen funcionando', async ({ page }) => {
  await importFiles(page, ['sample.txt']);
  await openBook(page, { format: 'TXT' });

  await page.keyboard.press('Control+f');
  let panel = page.locator('aside');
  await expect(panel).toBeVisible();
  await panel.getByPlaceholder(/Buscar en el libro/).fill('texto');
  await expect(panel.getByText('Texto plano de prueba')).toBeVisible();

  await panel.getByText('Texto plano de prueba').click();
  await expect(panel).toBeHidden();

  await page.getByTitle('Marcadores').click();
  panel = page.locator('aside');
  await expect(panel).toBeVisible();
  await panel.getByPlaceholder(/Nombre del marcador/).fill('Marcador E2E');
  await panel.locator('button.btn-primary').click();
  await expect(panel.getByText('Marcador E2E')).toBeVisible();
});
