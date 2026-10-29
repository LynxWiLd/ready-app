import { test, expect } from '@playwright/test';
import { importFiles } from './helpers.js';

test('importa EPUB, PDF, TXT y Markdown en la biblioteca', async ({ page }) => {
  await importFiles(page, ['sample.epub', 'sample.pdf', 'sample.txt', 'sample.md']);

  await expect(page.getByText(/4 libro\(s\)/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Abrir El Principito de Prueba' })
  ).toBeVisible();
  await expect(page.locator('article.card').filter({ hasText: 'PDF' })).toHaveCount(1);
  await expect(page.locator('article.card').filter({ hasText: 'TXT' })).toHaveCount(1);
  await expect(page.locator('article.card').filter({ hasText: 'Markdown' })).toHaveCount(1);
});
