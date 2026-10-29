import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import {
  importFiles,
  openBook,
  selectText,
  saveHighlight,
  preparePage,
  waitForLibrary,
  highlightKeys
} from './helpers.js';

test('exporta un backup y restaura el resaltado en otra sesión', async ({
  page,
  browser
}, testInfo) => {
  await importFiles(page, ['sample.txt']);
  await openBook(page, { format: 'TXT' });

  await selectText(page, 'lector de texto');
  await saveHighlight(page, { color: 'Verde', note: 'Backup E2E' });

  await page.getByTitle('Volver a la biblioteca').click();
  await expect(page.getByText(/1 libro\(s\)/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTitle('Exportar backup (.zip)').click();
  const download = await downloadPromise;

  const backupPath = testInfo.outputPath('ready-e2e.zip');
  await mkdir(path.dirname(backupPath), { recursive: true });
  await download.saveAs(backupPath);

  const zip = await JSZip.loadAsync(await readFile(backupPath));
  const index = JSON.parse(await zip.file('ready-backup.json').async('string'));
  expect(index.version).toBe(2);
  expect(index.highlights).toHaveLength(1);
  expect(index.highlights[0]).toMatchObject({
    text: 'lector de texto',
    note: 'Backup E2E',
    color: 'green'
  });

  const baseURL = testInfo.project.use.baseURL;
  const restoredContext = await browser.newContext({ baseURL });
  const restoredPage = await restoredContext.newPage();
  await preparePage(restoredPage);
  await restoredPage.goto('/');
  await waitForLibrary(restoredPage);
  await restoredPage
    .locator('input[type="file"][accept*=".zip"]')
    .setInputFiles(backupPath);

  await expect(restoredPage.locator('article.card')).toHaveCount(1);
  await restoredPage.locator('article.card').first().getByRole('button', { name: /^Abrir / }).click();
  await expect(restoredPage.locator('article')).toContainText('Texto plano de prueba');
  await expect.poll(() => highlightKeys(restoredPage)).toContain('ready-hl-green');

  await restoredContext.close();
});
