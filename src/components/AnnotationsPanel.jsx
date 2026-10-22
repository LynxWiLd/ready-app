import { useState } from 'react';
import {
  Highlighter,
  StickyNote,
  Trash2,
  Plus,
  ExternalLink,
  X,
  Pencil
} from 'lucide-react';
import { PanelShell } from './BookmarksPanel.jsx';
import { updateNote, removeNote } from '../services/bookmarks.js';
import { updateHighlight, removeHighlight } from '../services/highlights.js';
import { formatDateTime } from '../utils/format.js';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_NAMES,
  getHighlightColor
} from '../utils/highlights.js';

/**
 * Panel único de anotaciones: resaltados sobre texto y notas rápidas.
 */
export function AnnotationsPanel({
  highlights = [],
  notes = [],
  onAddNote,
  onJump,
  onChanged,
  onClose
}) {
  const [tab, setTab] = useState(highlights.length ? 'highlights' : 'notes');
  const [noteContent, setNoteContent] = useState('');
  const [noteEditingId, setNoteEditingId] = useState(null);
  const [noteEditValue, setNoteEditValue] = useState('');
  const [editingHighlightId, setEditingHighlightId] = useState(null);
  const [highlightNote, setHighlightNote] = useState('');
  const [highlightColor, setHighlightColor] = useState('yellow');

  const addNote = () => {
    if (!noteContent.trim()) return;
    onAddNote(noteContent.trim());
    setNoteContent('');
  };

  const saveNoteEdit = async (id) => {
    if (!noteEditValue.trim()) return;
    await updateNote(id, noteEditValue.trim());
    setNoteEditingId(null);
    onChanged();
  };

  const startHighlightEdit = (highlight) => {
    setEditingHighlightId(highlight.id);
    setHighlightNote(highlight.note || '');
    setHighlightColor(highlight.color || 'yellow');
  };

  const saveHighlightEdit = async (id) => {
    await updateHighlight(id, { note: highlightNote, color: highlightColor });
    setEditingHighlightId(null);
    onChanged();
  };

  const total = highlights.length + notes.length;

  return (
    <PanelShell title="Anotaciones" icon={Highlighter} count={total} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1">
        <button
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            tab === 'highlights' ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500'
          }`}
          onClick={() => setTab('highlights')}
        >
          Resaltados ({highlights.length})
        </button>
        <button
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            tab === 'notes' ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500'
          }`}
          onClick={() => setTab('notes')}
        >
          Notas ({notes.length})
        </button>
      </div>

      {tab === 'highlights' && (
        <div className="space-y-2">
          {highlights.length === 0 && (
            <p className="rounded-lg bg-ink-50 p-4 text-center text-sm text-ink-500">
              Selecciona un fragmento de texto en el libro para resaltarlo o anotarlo.
            </p>
          )}

          {highlights.map((highlight) => {
            const color = getHighlightColor(highlight.color);
            const editing = editingHighlightId === highlight.id;

            return (
              <div
                key={highlight.id}
                className="rounded-lg border border-ink-100 p-3 hover:border-indigo-200"
              >
                {editing ? (
                  <div className="space-y-2">
                    <textarea
                      className="field resize-none"
                      rows={3}
                      value={highlightNote}
                      onChange={(e) => setHighlightNote(e.target.value)}
                      placeholder="Nota opcional…"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-400">Color</span>
                      {HIGHLIGHT_COLOR_NAMES.map((name) => {
                        const item = HIGHLIGHT_COLORS[name];
                        return (
                          <button
                            key={name}
                            className={`h-5 w-5 rounded-full border-2 ${
                              highlightColor === name
                                ? 'scale-110 border-ink-700'
                                : 'border-white shadow-sm'
                            }`}
                            style={{ backgroundColor: item.hex }}
                            onClick={() => setHighlightColor(name)}
                            aria-label={`Color ${item.label}`}
                            title={item.label}
                          />
                        );
                      })}
                      <div className="ml-auto flex gap-1">
                        <button
                          className="icon-btn h-7 w-7"
                          onClick={() => setEditingHighlightId(null)}
                          title="Cancelar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="btn-primary px-2 py-1 text-xs"
                          onClick={() => saveHighlightEdit(highlight.id)}
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="min-w-0 flex-1">
                        <button className="block w-full text-left" onClick={() => onJump(highlight)}>
                          <p className="line-clamp-3 text-sm italic text-ink-700">
                            “{highlight.text}”
                          </p>
                        </button>
                        {highlight.note && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600">
                            {highlight.note}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-ink-400">
                          {formatDateTime(highlight.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      <button
                        className="icon-btn h-7 w-7"
                        title="Editar resaltado"
                        onClick={() => startHighlightEdit(highlight)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="icon-btn h-7 w-7"
                        title="Ir al resaltado"
                        onClick={() => onJump(highlight)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="icon-btn h-7 w-7"
                        title="Eliminar resaltado"
                        onClick={async () => {
                          await removeHighlight(highlight.id);
                          onChanged();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <div className="rounded-xl border border-ink-200 p-2">
            <textarea
              className="w-full resize-none bg-transparent p-1 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
              rows={3}
              placeholder="Escribe una nota rápida en tu posición actual…"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            <div className="flex justify-end border-t border-ink-100 pt-2">
              <button className="btn-primary" onClick={addNote} disabled={!noteContent.trim()}>
                <Plus className="h-4 w-4" /> Añadir nota
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {notes.length === 0 && (
              <p className="rounded-lg bg-ink-50 p-4 text-center text-sm text-ink-500">
                Aún no hay notas en este libro.
              </p>
            )}
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-ink-100 p-3 hover:border-indigo-200"
              >
                {noteEditingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="field"
                      rows={3}
                      value={noteEditValue}
                      onChange={(e) => setNoteEditValue(e.target.value)}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost" onClick={() => setNoteEditingId(null)}>
                        <X className="h-4 w-4" />
                      </button>
                      <button className="btn-primary" onClick={() => saveNoteEdit(note.id)}>
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm text-ink-700">{note.content}</p>
                    {note.anchorText && (
                      <p className="mt-2 line-clamp-2 border-l-2 border-indigo-200 pl-2 text-xs italic text-ink-400">
                        {note.anchorText}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-ink-400">
                        {formatDateTime(note.createdAt)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          className="icon-btn h-7 w-7"
                          title="Editar"
                          onClick={() => {
                            setNoteEditingId(note.id);
                            setNoteEditValue(note.content);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="icon-btn h-7 w-7"
                          title="Ir a la nota"
                          onClick={() => onJump(note)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="icon-btn h-7 w-7"
                          title="Eliminar"
                          onClick={async () => {
                            await removeNote(note.id);
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
        </div>
      )}

      {tab === 'notes' && notes.length === 0 && highlights.length > 0 && (
        <p className="mt-3 flex items-center gap-1 text-xs text-ink-400">
          <StickyNote className="h-3.5 w-3.5" /> Las notas rápidas se guardan en tu posición actual.
        </p>
      )}
    </PanelShell>
  );
}
