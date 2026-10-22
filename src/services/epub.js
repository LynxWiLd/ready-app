import ePubModule from 'epubjs';
import { truncate } from '../utils/format.js';
import { excerptAround, foldForSearch, foldQuery, searchLimit } from '../utils/search.js';

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
 * Concatena los nodos de texto del capítulo y busca sobre el texto plegado
 * (sin tildes ni mayúsculas). Así una consulta puede cruzar etiquetas inline
 * y las tildes no impiden encontrar la coincidencia.
 */
function searchSection(section, document, query, max, results, seen, signal) {
  const root = document.body || document.documentElement;
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  const starts = [];
  let combined = '';
  let node;

  while ((node = walker.nextNode())) {
    const value = node.nodeValue || '';
    if (!value) continue;
    nodes.push(node);
    starts.push(combined.length);
    combined += value;
  }
  if (!combined) return;

  const folded = foldForSearch(combined);
  const locate = (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return { node: nodes[lo], offset: index - starts[lo] };
  };

  let from = 0;
  while (results.length < max) {
    if (signal?.aborted) return;
    const at = folded.text.indexOf(query, from);
    if (at === -1) break;

    const combinedStart = folded.map[at];
    const combinedEnd = folded.map[at + query.length - 1] + 1;
    const start = locate(combinedStart);
    const last = locate(combinedEnd - 1);

    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(last.node, last.offset + 1);
      const cfi = section.cfiFromRange(range);
      if (cfi && !seen.has(cfi)) {
        seen.add(cfi);
        results.push({
          id: `epub-${results.length}`,
          cfi,
          excerpt: excerptAround(combined, combinedStart, combinedEnd)
        });
      }
    } catch {
      /* rango no representable; continuar */
    }

    from = at + query.length;
  }
}

/**
 * Busca una cadena en todos los capítulos de la spine.
 * `section.load()` permite analizar capítulos que aún no se han mostrado.
 * @returns {Promise<Array<{id: string, cfi: string, excerpt: string}>>}
 */
export async function searchEpub(book, query, { limit = 100, signal } = {}) {
  const q = foldQuery(query);
  if (q.length < 2 || typeof book?.load !== 'function') return [];
  const sections = book?.spine?.spineItems || [];
  if (!sections.length) return [];

  const max = searchLimit(limit);
  const load = book.load.bind(book);
  const seen = new Set();
  const results = [];

  for (const section of sections) {
    if (signal?.aborted || results.length >= max) break;
    let loaded = false;
    try {
      await section.load(load);
      loaded = true;
      const document = section.document || section.contents?.ownerDocument;
      if (!document) continue;

      // Algunos capítulos ya renderizados no exponen `document` directamente.
      const previousDocument = section.document;
      if (!previousDocument) section.document = document;
      try {
        searchSection(section, document, q, max, results, seen, signal);
      } finally {
        if (!previousDocument) section.document = undefined;
      }
    } catch {
      /* capítulo no legible; continuar con el resto */
    } finally {
      if (loaded) {
        try {
          section.unload();
        } catch {
          /* noop */
        }
      }
    }
  }

  return results;
}

/**
 * Crea una instancia de libro lista para el lector.
 * @returns {import('epubjs').Book}
 */
export function openEpub(blob) {
  // epubjs acepta ArrayBuffer; se crea bajo demanda al abrir el lector.
  return blob;
}
