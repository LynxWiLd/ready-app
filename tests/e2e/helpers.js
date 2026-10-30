import { expect } from '@playwright/test';
import path from 'node:path';

export const FIXTURES = path.resolve('.test-files');

const READER_SETTINGS = {
  theme: 'light',
  font: 'sans',
  fontSize: 18,
  lineHeight: 1.6,
  maxWidth: 720,
  margin: 16,
  pdfZoom: 1.15,
  pdfView: 'scroll',
  autoHideUI: false
};

/** Prepara el lector con controles siempre visibles para las pruebas. */
export async function preparePage(page) {
  await page.addInitScript((settings) => {
    localStorage.setItem('ready.reader.settings', JSON.stringify(settings));
    // La presentación de permisos solo aparece en PWA instalada; en las
    // pruebas la damos por vista para que nunca tape la interfaz.
    localStorage.setItem('ready.permissions.intro', '1');
  }, READER_SETTINGS);
}

/**
 * Espera a que la biblioteca termine de leer IndexedDB.
 * Mientras `loading` es true, LibraryView monta el DropZone en otra rama del
 * árbol: al pasar a la biblioteca vacía React lo desmonta y remonta, así que
 * cargar archivos antes de tiempo se pierde en un nodo huérfano.
 * El encabezado «Tus documentos, en tu dispositivo» también existe durante la
 * carga; el estado vacío real es «Tu biblioteca está vacía».
 */
export async function waitForLibrary(page) {
  await expect(page.getByText('Tus documentos, en tu dispositivo')).toBeVisible();
  await expect(page.getByText('Tu biblioteca está vacía')).toBeVisible();
  await expect(page.locator('#library-picker')).toBeAttached();
}

/** Importa uno o varios fixtures y espera a que aparezcan sus tarjetas. */
export async function importFiles(page, names) {
  await preparePage(page);
  await page.goto('/');
  await waitForLibrary(page);

  const files = names.map((name) => path.join(FIXTURES, name));
  await page.locator('#library-picker').setInputFiles(files);
  await expect(page.locator('article.card')).toHaveCount(names.length, { timeout: 25_000 });
}

/** Abre el libro indicado desde la biblioteca. */
export async function openBook(page, { title, format } = {}) {
  let card = page.locator('article.card');
  if (format) card = card.filter({ hasText: format });
  if (title) card = card.filter({ hasText: title });

  const target = card.first();
  await expect(target).toBeVisible();
  await target.getByRole('button', { name: /^Abrir / }).click();
  await expect(page).toHaveURL(/#\/read\//);
}

/** Selecciona un texto dentro del artículo de TXT/Markdown. */
export async function selectText(page, phrase) {
  await expect(page.locator('article')).toContainText(phrase, { timeout: 20_000 });

  await page.evaluate((text) => {
    const root = document.querySelector('article');
    if (!root) throw new Error('No se encontró el artículo del lector.');

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.nodeValue.indexOf(text);
      if (index === -1) continue;

      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }
    throw new Error(`No se encontró el texto: ${text}`);
  }, phrase);

  await expect(page.getByText('Resaltar fragmento')).toBeVisible();
}

/** Selecciona una frase dentro de la capa de texto del PDF. */
export async function selectPdfText(page, phrase) {
  await page.evaluate((text) => {
    const layer = document.querySelector('.pdf-text-layer');
    if (!layer) throw new Error('No se encontró la capa de texto del PDF.');

    const span = [...layer.querySelectorAll('span')].find((item) =>
      item.textContent.includes(text)
    );
    if (!span) throw new Error(`No se encontró el texto PDF: ${text}`);

    const node = [...span.childNodes].find((child) => child.nodeType === Node.TEXT_NODE);
    if (!node) throw new Error('El texto del PDF no tiene nodo de texto.');

    const index = node.nodeValue.indexOf(text);
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + text.length);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  }, phrase);

  await expect(page.getByText('Resaltar fragmento')).toBeVisible();
}

/** Espera a que el iframe de EPUB tenga contenido y lo devuelve. */
export async function waitForEpubFrame(page, text) {
  await expect
    .poll(
      async () => {
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue;
          try {
            const body = await frame.locator('body').innerText({ timeout: 1000 });
            if (body.includes(text)) return true;
          } catch {
            /* el frame todavía se está cargando */
          }
        }
        return false;
      },
      { timeout: 20_000 }
    )
    .toBe(true);

  return page.frames().find((frame) => frame !== page.mainFrame());
}

/** Selecciona un texto dentro del iframe de EPUB. */
export async function selectEpubText(page, phrase) {
  const frame = await waitForEpubFrame(page, phrase);

  await frame.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.nodeValue.indexOf(text);
      if (index === -1) continue;

      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }
    throw new Error(`No se encontró el texto EPUB: ${text}`);
  }, phrase);

  await expect(page.getByText('Resaltar fragmento')).toBeVisible();
}

/** Guarda el resaltado abierto en la tarjeta flotante. */
export async function saveHighlight(page, { color, note = '' } = {}) {
  if (color) {
    await page.getByRole('button', { name: `Color ${color}` }).click();
  }
  if (note) {
    await page.getByPlaceholder(/Nota opcional/).fill(note);
  }
  await page.getByRole('button', { name: /Guardar resaltado/ }).click();
  await expect(page.getByText('Resaltar fragmento')).toBeHidden();
}

/** Abre el panel de anotaciones. */
export async function openAnnotations(page) {
  await page.getByTitle('Anotaciones').click();
  const panel = page.locator('aside');
  await expect(panel).toBeVisible();
  return panel;
}

/** Claves activas de CSS Custom Highlight en la página. */
export function highlightKeys(page) {
  return page.evaluate(() => (window.CSS?.highlights ? [...CSS.highlights.keys()] : []));
}
