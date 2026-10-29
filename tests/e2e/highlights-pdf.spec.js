import { test, expect } from '@playwright/test';
import {
  importFiles,
  openBook,
  selectPdfText,
  saveHighlight,
  openAnnotations
} from './helpers.js';

test('crea, salta y elimina un resaltado en PDF', async ({ page }) => {
  await importFiles(page, ['sample.pdf']);
  await openBook(page, { format: 'PDF' });

  await expect(
    page.locator('.pdf-text-layer span').filter({ hasText: 'Pagina de prueba 1' }).first()
  ).toBeVisible({ timeout: 20_000 });

  await selectPdfText(page, 'Pagina de prueba 1');
  await saveHighlight(page, { color: 'Amarillo', note: 'Nota E2E PDF' });

  await expect(page.locator('.pdf-highlight-rect')).toHaveCount(1);

  let panel = await openAnnotations(page);
  await expect(panel.getByText('Pagina de prueba 1')).toBeVisible();
  await expect(panel.getByText('Nota E2E PDF')).toBeVisible();
  await panel.getByTitle('Ir al resaltado').click();
  await expect(page.locator('aside')).toBeHidden();

  panel = await openAnnotations(page);
  await panel.getByTitle('Eliminar resaltado').click();
  await expect.poll(() => page.locator('.pdf-highlight-rect').count()).toBe(0);
});
