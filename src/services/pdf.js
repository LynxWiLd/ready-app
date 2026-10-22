import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { titleFromFile, clean } from './epub.js';
import { truncate } from '../utils/format.js';

// El worker se sirve como asset local (Vite) — nunca se descarga de CDN (RNF-01).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function parsePdf(blob) {
  const data = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data }).promise;
  try {
    const { info = {}, metadata } = await doc.getMetadata().catch(() => ({}));
    const title = clean(info.Title) || titleFromFile(blob.name);
    let description = '';
    try {
      const meta = metadata;
      if (meta) {
        description = meta.get('dc:description') || '';
      }
    } catch {
      description = '';
    }
    // Portada de preview: primera página renderizada (visual en la biblioteca).
    const coverBlob = await renderPdfCover(doc);
    return {
      title,
      author: clean(info.Author) || 'Autor desconocido',
      language: clean(info.Language),
      publisher: clean(info.Producer) || '',
      description: truncate(clean(description), 400),
      spineCount: doc.numPages,
      wordCount: null,
      coverBlob
    };
  } finally {
    doc.destroy();
  }
}

/**
 * Renderiza la primera página del documento como miniatura de portada.
 * Devuelve un Blob JPEG o null si el render no está disponible (p. ej. Node).
 */
export async function renderPdfCover(doc, { width = 400, quality = 0.82 } = {}) {
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    page.cleanup?.();
    return blob;
  } catch {
    return null;
  }
}

/**
 * Extrae el outline (índice) del PDF como lista plana con profundidad y
 * número de página (1-based). Las entradas sin destino resoluble se omiten.
 * @returns {Promise<Array<{label: string, page: number, depth: number}>>}
 */
export async function getPdfOutline(doc) {
  let outline = [];
  try {
    outline = (await doc.getOutline()) || [];
  } catch {
    return [];
  }
  if (!outline.length) return [];

  // 1) Aplanar el árbol conservando el orden y la profundidad.
  const raw = [];
  const walk = (items, depth) => {
    for (const item of items || []) {
      raw.push({ label: clean(item.title) || 'Sin título', dest: item.dest, depth });
      if (item.items?.length) walk(item.items, depth + 1);
    }
  };
  walk(outline, 0);

  // 2) Resolver los destinos en paralelo (son promesas independientes).
  const pageForDest = async (dest) => {
    try {
      let explicit = dest;
      if (typeof dest === 'string') explicit = await doc.getDestination(dest);
      if (!Array.isArray(explicit) || explicit.length === 0) return null;
      // Lo normal es una referencia de página; algunos PDFs usan un índice.
      const pageIndex =
        typeof explicit[0] === 'number' ? explicit[0] : await doc.getPageIndex(explicit[0]);
      return pageIndex + 1;
    } catch {
      return null;
    }
  };
  const pages = await Promise.all(raw.map((entry) => pageForDest(entry.dest)));

  return raw
    .map((entry, i) => ({ label: entry.label, page: pages[i], depth: entry.depth }))
    .filter((entry) => Number.isInteger(entry.page) && entry.page > 0);
}

/**
 * Abre un PDF para lectura y cachea el documento.
 * RNF-02: el render es perezoso (solo páginas visibles).
 */
export async function openPdf(blob) {
  const data = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data }).promise;
  return {
    doc,
    numPages: doc.numPages,
    destroy() {
      try {
        doc.destroy();
      } catch {
        /* noop */
      }
    }
  };
}
