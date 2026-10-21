import { useState } from 'react';
import { Bookmark, Trash2, Plus, ExternalLink } from 'lucide-react';

/**
 * Panel de marcadores.
 * props: bookmarks, onAdd(label), onJump(bm), onRemove(id)
 */
export function BookmarksPanel({ bookmarks, onAdd, onJump, onRemove, onClose }) {
  const [label, setLabel] = useState('');

  const add = () => {
    onAdd(label.trim() || defaultLabel(bookmarks.length));
    setLabel('');
  };

  return (
    <PanelShell title="Marcadores" icon={Bookmark} count={bookmarks.length} onClose={onClose}>
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Nombre del marcador…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-primary shrink-0" onClick={add} disabled={bookmarks.length === 0 && !label}>
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {bookmarks.length === 0 && (
          <p className="rounded-lg bg-ink-50 p-4 text-center text-sm text-ink-500">
            Coloca el cursor en un punto del libro y añade un marcador.
          </p>
        )}
        {bookmarks.map((b) => (
          <div key={b.id} className="group flex items-center gap-2 rounded-lg border border-ink-100 p-2.5 hover:border-indigo-200">
            <Bookmark className="h-4 w-4 shrink-0 text-indigo-500" />
            <button className="min-w-0 flex-1 text-left" onClick={() => onJump(b)}>
              <p className="truncate text-sm font-medium text-ink-800">{b.label}</p>
              {b.anchorText && <p className="truncate text-xs text-ink-400">{b.anchorText}</p>}
            </button>
            <button className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onJump(b)} title="Ir al marcador">
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onRemove(b.id)} title="Eliminar">
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            </button>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function defaultLabel(n) {
  return `Marcador ${n + 1}`;
}

export function PanelShell({ title, icon: Icon, count, onClose, children }) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-ink-800">{title}</h2>
          {count != null && <span className="chip bg-ink-100 text-ink-500">{count}</span>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar panel">
          <Trash2 className="hidden" />
          <span className="text-sm text-ink-500">Cerrar</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
