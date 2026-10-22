import { Loader2, Search, X } from 'lucide-react';
import { PanelShell } from './BookmarksPanel.jsx';
import { foldForSearch, foldQuery } from '../utils/search.js';

/**
 * Panel de búsqueda dentro del libro.
 * props: query, onQueryChange, results, searching, error, onJump(result), onClose
 */
export function SearchPanel({ query, onQueryChange, results, searching, error, onJump, onClose }) {
  const trimmed = query.trim();

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !searching && results.length > 0) onJump(results[0]);
  };

  return (
    <PanelShell
      title="Buscar en el libro"
      icon={Search}
      count={searching ? null : results.length}
      onClose={onClose}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          autoFocus
          className="field pl-8 pr-9"
          placeholder="Buscar en el libro…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Buscar en el libro"
        />
        {query && (
          <button
            className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onQueryChange('')}
            title="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}

        {!error && searching && (
          <p className="flex items-center justify-center gap-2 rounded-lg bg-ink-50 p-4 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
          </p>
        )}

        {!error && !searching && trimmed.length < 2 && (
          <p className="rounded-lg bg-ink-50 p-4 text-center text-sm text-ink-500">
            Escribe al menos 2 caracteres.
          </p>
        )}

        {!error && !searching && trimmed.length >= 2 && results.length === 0 && (
          <p className="rounded-lg bg-ink-50 p-4 text-center text-sm text-ink-500">
            Sin coincidencias.
          </p>
        )}

        {!error &&
          !searching &&
          results.map((result) => (
            <button
              key={result.id}
              className="block w-full rounded-lg border border-ink-100 p-2.5 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
              onClick={() => onJump(result)}
            >
              {result.page != null && (
                <p className="mb-1 text-xs font-medium text-indigo-600">Página {result.page}</p>
              )}
              <p className="line-clamp-3 text-sm text-ink-700">
                {highlight(result.excerpt, trimmed)}
              </p>
            </button>
          ))}
      </div>
    </PanelShell>
  );
}

function highlight(text, query) {
  const source = String(text || '');
  const q = foldQuery(query);
  if (!q) return source;

  const folded = foldForSearch(source);
  const parts = [];
  let foldedFrom = 0;
  let sourceFrom = 0;
  let at = folded.text.indexOf(q, foldedFrom);

  while (at !== -1) {
    const start = folded.map[at];
    const end = folded.map[at + q.length - 1] + 1;
    if (start > sourceFrom) parts.push(source.slice(sourceFrom, start));
    parts.push(
      <mark key={parts.length} className="rounded bg-amber-200/70 px-0.5 text-inherit">
        {source.slice(start, end)}
      </mark>
    );
    sourceFrom = end;
    foldedFrom = at + q.length;
    at = folded.text.indexOf(q, foldedFrom);
  }

  if (!parts.length) return source;
  if (sourceFrom < source.length) parts.push(source.slice(sourceFrom));
  return parts;
}
