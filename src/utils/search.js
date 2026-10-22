/**
 * Utilidades de búsqueda en texto: insensible a mayúsculas y tildes.
 * `foldForSearch` conserva un mapa índice-normalizado → índice original para
 * poder construir rangos y extractos sobre el texto real.
 */
export function foldForSearch(value) {
  const source = String(value ?? '');
  let text = '';
  const map = [];
  let pendingSpace = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    // Colapsar espacios (incluidos saltos de línea) para que una frase pueda
    // encontrarse aunque el texto original esté partido en varias líneas.
    if (/\s/.test(char)) {
      pendingSpace = text.length > 0;
      continue;
    }
    if (pendingSpace) {
      text += ' ';
      map.push(i);
      pendingSpace = false;
    }
    const folded = char
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    for (let j = 0; j < folded.length; j++) {
      text += folded[j];
      map.push(i);
    }
  }

  return { text, map };
}

/** Consulta normalizada (sin tildes, minúsculas y con espacios colapsados). */
export function foldQuery(query) {
  return foldForSearch(query).text.replace(/\s+/g, ' ').trim();
}

/** Extracto legible alrededor de una coincidencia. */
export function excerptAround(text, start, end, radius = 55) {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const fragment = text
    .slice(from, to)
    .replace(/\s+/g, ' ')
    .trim();
  return `${from > 0 ? '…' : ''}${fragment}${to < text.length ? '…' : ''}`;
}

/** Limita y normaliza resultados de búsqueda. */
export function searchLimit(limit = 100) {
  return Math.max(1, Math.min(500, Number(limit) || 100));
}
