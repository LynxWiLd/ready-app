/**
 * Colores y utilidades de resaltados. Los nombres se guardan en IndexedDB.
 */
export const HIGHLIGHT_COLORS = {
  yellow: {
    label: 'Amarillo',
    hex: '#fbbf24',
    css: 'rgba(251, 191, 36, 0.55)'
  },
  green: {
    label: 'Verde',
    hex: '#34d399',
    css: 'rgba(52, 211, 153, 0.5)'
  },
  blue: {
    label: 'Azul',
    hex: '#60a5fa',
    css: 'rgba(96, 165, 250, 0.5)'
  },
  pink: {
    label: 'Rosa',
    hex: '#f472b6',
    css: 'rgba(244, 114, 182, 0.45)'
  }
};

export const HIGHLIGHT_COLOR_NAMES = Object.keys(HIGHLIGHT_COLORS);

/** Devuelve una definición de color válida (amarillo por defecto). */
export function getHighlightColor(name) {
  return HIGHLIGHT_COLORS[name] || HIGHLIGHT_COLORS.yellow;
}

/** Devuelve un nombre de color válido (amarillo por defecto). */
export function getHighlightColorName(name) {
  return HIGHLIGHT_COLORS[name] ? name : 'yellow';
}

/**
 * Crea un Range del DOM a partir de desplazamientos de texto dentro de `root`.
 * Los desplazamientos son los mismos que produce `Range.toString()`.
 */
export function rangeFromOffsets(root, start, end) {
  if (!root || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let position = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;
  let node;

  while ((node = walker.nextNode())) {
    const length = node.nodeValue?.length || 0;
    if (!startNode && start < position + length) {
      startNode = node;
      startOffset = start - position;
    }
    if (end <= position + length) {
      endNode = node;
      endOffset = end - position;
      break;
    }
    position += length;
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

/** Serializa una selección de texto en offsets estables dentro de `root`. */
export function quoteFromRange(root, range) {
  if (!root || !range) return null;
  const exact = range.toString();
  if (!exact.trim()) return null;

  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  const text = root.textContent || '';

  return {
    start,
    end: start + exact.length,
    exact: exact.slice(0, 2000),
    prefix: text.slice(Math.max(0, start - 40), start),
    suffix: text.slice(start + exact.length, start + exact.length + 40)
  };
}

/** Desplaza el contenedor para dejar visible el inicio de un Range. */
export function scrollRangeIntoView(container, range, offset = 72) {
  if (!container || !range) return false;
  try {
    const rect = range.getBoundingClientRect();
    if (!rect.height && !rect.width) return false;
    const base = container.getBoundingClientRect();
    const top = Math.max(0, container.scrollTop + rect.top - base.top - offset);
    container.scrollTo({ top, behavior: 'smooth' });
    return true;
  } catch {
    return false;
  }
}
