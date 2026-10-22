import { useEffect, useState } from 'react';
import { Highlighter, Loader2 } from 'lucide-react';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_NAMES } from '../utils/highlights.js';

/**
 * Tarjeta flotante que aparece al seleccionar texto.
 * Permite elegir color y añadir una nota antes de guardar el resaltado.
 */
export function SelectionToolbar({ selection, saving, onSave, onCancel }) {
  const [color, setColor] = useState('yellow');
  const [note, setNote] = useState('');

  useEffect(() => {
    setColor('yellow');
    setNote('');
  }, [selection]);

  if (!selection) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-ink-200 bg-white/95 p-3 text-ink-800 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
              <Highlighter className="h-3.5 w-3.5" /> Resaltar fragmento
            </p>
            <p className="mt-1 line-clamp-2 text-sm italic text-ink-500">“{selection.text}”</p>
          </div>
          <button className="text-xs font-medium text-ink-400 hover:text-ink-700" onClick={onCancel}>
            Cancelar
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-ink-400">Color</span>
          {HIGHLIGHT_COLOR_NAMES.map((name) => {
            const item = HIGHLIGHT_COLORS[name];
            return (
              <button
                key={name}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  color === name ? 'scale-110 border-ink-700' : 'border-white shadow-sm'
                }`}
                style={{ backgroundColor: item.hex }}
                onClick={() => setColor(name)}
                aria-label={`Color ${item.label}`}
                title={item.label}
              />
            );
          })}
        </div>

        <textarea
          className="field mt-3 resize-none"
          rows={2}
          placeholder="Nota opcional…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="mt-2 flex justify-end">
          <button className="btn-primary" onClick={() => onSave({ color, note: note.trim() })} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Highlighter className="h-4 w-4" />}
            Guardar resaltado
          </button>
        </div>
      </div>
    </div>
  );
}
