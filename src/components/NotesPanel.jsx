import { useState } from 'react';
import { StickyNote, Trash2, Plus, ExternalLink, X } from 'lucide-react';
import { PanelShell } from './BookmarksPanel.jsx';
import { updateNote, removeNote } from '../services/bookmarks.js';
import { formatDateTime } from '../utils/format.js';

export function NotesPanel({ notes, onAdd, onJump, onChanged, onClose }) {
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const add = () => {
    if (!content.trim()) return;
    onAdd(content.trim());
    setContent('');
  };

  const saveEdit = async (id) => {
    if (!editValue.trim()) return;
    await updateNote(id, editValue.trim());
    setEditingId(null);
    onChanged();
  };

  return (
    <PanelShell title="Notas" icon={StickyNote} count={notes.length} onClose={onClose}>
      <div className="rounded-xl border border-ink-200 p-2">
        <textarea
          className="w-full resize-none bg-transparent p-1 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
          rows={3}
          placeholder="Escribe una nota rápida en tu posición actual…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end border-t border-ink-100 pt-2">
          <button className="btn-primary" onClick={add} disabled={!content.trim()}>
            <Plus className="h-4 w-4" /> Añadir nota
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {notes.length === 0 && (
          <p className="rounded-lg bg-ink-50 p-4 text-center text-sm text-ink-500">Aún no hay notas en este libro.</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg border border-ink-100 p-3 hover:border-indigo-200">
            {editingId === n.id ? (
              <div className="space-y-2">
                <textarea
                  className="field"
                  rows={3}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </button>
                  <button className="btn-primary" onClick={() => saveEdit(n.id)}>
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm text-ink-700">{n.content}</p>
                {n.anchorText && <p className="mt-2 line-clamp-2 border-l-2 border-indigo-200 pl-2 text-xs italic text-ink-400">{n.anchorText}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-400">{formatDateTime(n.createdAt)}</span>
                  <div className="flex gap-1">
                    <button
                      className="icon-btn h-7 w-7"
                      title="Editar"
                      onClick={() => {
                        setEditingId(n.id);
                        setEditValue(n.content);
                      }}
                    >
                      <StickyNote className="h-3.5 w-3.5" />
                    </button>
                    <button className="icon-btn h-7 w-7" title="Ir a la nota" onClick={() => onJump(n)}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="icon-btn h-7 w-7"
                      title="Eliminar"
                      onClick={async () => {
                        await removeNote(n.id);
                        onChanged();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
