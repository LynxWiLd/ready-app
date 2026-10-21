/** Pequeño helper para construir clases condicionales sin dependencias. */
export function cn(...parts) {
  return parts
    .filter(Boolean)
    .flatMap((p) => (Array.isArray(p) ? p : String(p).split(' ')))
    .filter(Boolean)
    .join(' ');
}
