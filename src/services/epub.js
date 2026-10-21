import ePubModule from 'epubjs';
import { truncate } from '../utils/format.js';

// Normaliza el interop CJS/ESM de epubjs (Vite usa el build ESM, Node el CJS).
const ePub = typeof ePubModule === 'function' ? ePubModule : ePubModule.default || ePubModule;

/**
 * Parsea un EPUB para extraer metadatos y portada.
 * R-02: envuelto en try/catch por si el archivo está dañado.
 * RNF-02: el libro se destruye tras extraer (no se mantiene en memoria).
 */
export async function parseEpub(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const book = ePub(arrayBuffer);
  try {
    await book.ready;
    const meta = await book.loaded.metadata;
    let coverBlob = null;
    try {
      const url = await book.coverUrl();
      if (url) {
        const res = await fetch(url);
        coverBlob = await res.blob();
      }
    } catch {
      coverBlob = null;
    }
    const spineCount = book.spine?.length ?? 0;
    return {
      title: clean(meta.title) || titleFromFile(blob.name),
      author: clean(meta.creator) || 'Autor desconocido',
      language: clean(meta.language),
      publisher: clean(meta.publisher),
      description: truncate(clean(meta.description), 400),
      spineCount,
      coverBlob
    };
  } finally {
    try {
      book.destroy();
    } catch {
      /* noop */
    }
  }
}

export function clean(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

export function titleFromFile(name) {
  return (name || '').replace(/\.[^.]+$/, '') || 'Sin título';
}

// ---------------- Tabla de contenidos (TOC) ----------------

function dirname(p) {
  if (!p) return '';
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

function joinPath(dir, rel) {
  if (!dir) return rel || '';
  if (!rel) return dir;
  return `${dir}/${rel}`;
}

/**
 * Resuelve un href de la TOC (relativo al documento nav/NCX) contra la spine
 * (hrefs relativos al OPF). Devuelve `href#fragmento` listo para
 * `rendition.display()`, o el href original si no hay spine equivalente.
 */
export function resolveTocHref(book, navDir, rawHref) {
  if (!rawHref) return '';
  const hashIndex = rawHref.indexOf('#');
  const pathPart = hashIndex === -1 ? rawHref : rawHref.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : rawHref.slice(hashIndex);
  const candidates = navDir ? [joinPath(navDir, pathPart), pathPart] : [pathPart];
  for (const candidate of candidates) {
    try {
      if (candidate && book?.spine?.get?.(candidate)) {
        return `${candidate}${fragment}`;
      }
    } catch {
      /* candidato no válido */
    }
  }
  return rawHref;
}

/**
 * hrefs OPF-relativos de la spine, en orden de índice.
 * `locationChanged` emite `loc.index` (posición de spine) y un `href`
 * relativo al nav, así que el índice es la clave fiable para correlacionar.
 */
export async function spineHrefs(book) {
  try {
    const items = await book.loaded.spine;
    if (Array.isArray(items)) return items.map((s) => s.href);
  } catch {
    /*.loaded.spine no disponible */
  }
  const n = book?.spine?.spineItems?.length || 0;
  return Array.from({ length: n }, (_, i) => book.spine.spineItems[i]?.href || null);
}

/**
 * Aplana la navegación del EPUB en una lista lineal con profundidad.
 * Cada entrada queda anclada a su índice de spine para poder navegar
 * (`rendition.display()`) y resaltar el capítulo activo.
 * @returns {Array<{label: string, href: string, depth: number, spineIndex: number|null}>}
 */
export async function buildTocList(book, navigation) {
  const spineHrefsList = await spineHrefs(book);
  const navDir = dirname(book?.packaging?.navPath || book?.packaging?.ncxPath || '');
  const flat = [];
  const walk = (items, depth) => {
    for (const item of items || []) {
      const resolved = resolveTocHref(book, navDir, item.href);
      const base = (resolved || '').split('#')[0];
      let spineIndex = spineHrefsList.indexOf(base);
      if (spineIndex === -1) {
        try {
          spineIndex = book?.spine?.get?.(base)?.index ?? null;
        } catch {
          spineIndex = null;
        }
        if (spineIndex === undefined) spineIndex = null;
      }
      flat.push({
        label: clean(item.label) || 'Sin título',
        href: resolved,
        depth,
        spineIndex: spineIndex === -1 ? null : spineIndex
      });
      if (item.subItems?.length) walk(item.subItems, depth + 1);
    }
  };
  walk(navigation?.toc || [], 0);
  return flat;
}

/**
 * Índice índice-de-spine → posición en la lista aplanada.
 * Ignora entradas cuyo destino no resuelve a un elemento de spine.
 */
export function buildTocIndex(flat) {
  const bySpineIndex = new Map();
  flat.forEach((item, i) => {
    if (item.spineIndex == null || bySpineIndex.has(item.spineIndex)) return;
    bySpineIndex.set(item.spineIndex, i);
  });
  return bySpineIndex;
}

/**
 * Crea una instancia de libro lista para el lector.
 * @returns {import('epubjs').Book}
 */
export function openEpub(blob) {
  // epubjs acepta ArrayBuffer; se crea bajo demanda al abrir el lector.
  return blob;
}
