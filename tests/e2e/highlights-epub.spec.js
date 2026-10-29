import { test, expect } from '@playwright/test';
import {
  importFiles,
  openBook,
  selectEpubText,
  saveHighlight,
  openAnnotations
} from './helpers.js';

test('crea y persiste un resaltado en EPUB', async ({ page }) => {
  await importFiles(page, ['sample.epub']);
  await openBook(page, { title: 'El Principito de Prueba', format: 'EPUB' });

  await selectEpubText(page, 'principito');
  await saveHighlight(page, { color: 'Verde', note: 'Nota E2E EPUB' });

  await expect(page.locator('.ready-hl-green')).toHaveCount(1);
  const panel = await openAnnotations(page);
  await expect(panel.getByText('principito')).toBeVisible();
  await expect(panel.getByText('Nota E2E EPUB')).toBeVisible();

  await page.reload();
  await expect(page.locator('iframe')).toBeVisible();
  await expect(page.locator('.ready-hl-green')).toHaveCount(1);
});
