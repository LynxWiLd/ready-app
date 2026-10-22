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
