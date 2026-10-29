import { test, expect } from '@playwright/test';
import {
  importFiles,
  openBook,
  selectText,
  saveHighlight,
  openAnnotations,
  highlightKeys
} from './helpers.js';

test('crea un resaltado en Markdown', async ({ page }) => {
  await importFiles(page, ['sample.md']);
  await openBook(page, { format: 'Markdown' });
  await expect(page.locator('article')).toContainText('Documento Markdown de prueba');

  await selectText(page, 'Markdown');
  await saveHighlight(page, { color: 'Rosa' });

  await expect.poll(() => highlightKeys(page)).toContain('ready-hl-pink');
  const panel = await openAnnotations(page);
  await expect(panel.getByText('Markdown')).toBeVisible();
});

test('crea, edita, persiste y elimina un resaltado en TXT', async ({ page }) => {
  await importFiles(page, ['sample.txt']);
  await openBook(page, { format: 'TXT' });
  await expect(page.locator('article')).toContainText('Texto plano de prueba');

  await selectText(page, 'lector de texto');
  await saveHighlight(page, { color: 'Verde', note: 'Nota E2E TXT' });

  await expect.poll(() => highlightKeys(page)).toContain('ready-hl-green');

  let panel = await openAnnotations(page);
  await expect(panel.getByText('lector de texto')).toBeVisible();
  await expect(panel.getByText('Nota E2E TXT')).toBeVisible();

  await panel.getByTitle('Editar resaltado').click();
  await panel.getByRole('button', { name: 'Color Azul' }).click();
  await panel.getByPlaceholder(/Nota opcional/).fill('Nota editada E2E');
  await panel.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(panel.getByText('Nota editada E2E')).toBeVisible();
  await expect.poll(() => highlightKeys(page)).toContain('ready-hl-blue');

  await page.reload();
  await expect(page.locator('article')).toContainText('Texto plano de prueba');
  await expect.poll(() => highlightKeys(page)).toContain('ready-hl-blue');

  panel = await openAnnotations(page);
  await expect(panel.getByText('Nota editada E2E')).toBeVisible();
  await panel.getByTitle('Eliminar resaltado').click();

  await expect(panel.getByText('Resaltados (0)')).toBeVisible();
  await expect.poll(() => highlightKeys(page)).toEqual([]);
});
