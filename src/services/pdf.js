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
    return {
      title,
      author: clean(info.Author) || 'Autor desconocido',
      language: clean(info.Language),
      publisher: clean(info.Producer) || '',
      description: truncate(clean(description), 400),
      spineCount: doc.numPages,
      wordCount: null
    };
  } finally {
    doc.destroy();
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
