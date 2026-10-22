import { useCallback, useRef, useState } from 'react';
import { FileUp, UploadCloud } from 'lucide-react';
import { ACCEPT_EXTENSIONS } from '../utils/magic.js';

/**
 * Zona de importación: arrastrar y soltar + selector de archivos.
 * RF-01.
 */
export function DropZone({ onFiles, compact = false, inputId }) {
  const [active, setActive] = useState(false);
  const inputRef = useRef(null);
  const counter = useRef(0);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      // Evita que el listener global de LibraryView importe el archivo otra vez.
      e.stopPropagation();
      counter.current = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  const onDragEnter = (e) => {
    e.preventDefault();
    counter.current += 1;
    setActive(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    counter.current -= 1;
    if (counter.current <= 0) setActive(false);
  };
  const onDragOver = (e) => e.preventDefault();

  if (compact) {
    return (
      <div
        onDrop={handleDrop}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm transition ${
          active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-ink-200 text-ink-500'
        }`}
      >
        <UploadCloud className="h-4 w-4" />
        <span>Arrastra archivos aquí</span>
        <button className="ml-1 font-medium text-indigo-600 hover:underline" onClick={() => inputRef.current?.click()}>
          o elige
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_EXTENSIONS}
          multiple
          className="hidden"
          onChange={(e) => onFiles(Array.from(e.target.files || []))}
        />
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition ${
        active ? 'border-indigo-400 bg-indigo-50/70' : 'border-ink-200 bg-white/60'
      }`}
    >
      <div className={`rounded-full p-4 transition ${active ? 'bg-indigo-100 text-indigo-600' : 'bg-ink-100 text-ink-400'}`}>
        <FileUp className="h-8 w-8" />
      </div>
      <div>
        <p className="text-base font-medium text-ink-700">Arrastra libros o documentos aquí</p>
        <p className="mt-1 text-sm text-ink-500">EPUB · PDF · TXT · Markdown</p>
      </div>
      <button className="btn-primary" onClick={() => inputRef.current?.click()}>
        Seleccionar archivos
      </button>
      <p className="text-xs text-ink-400">Todo se guarda localmente en tu navegador. Nada se sube a ningún servidor.</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_EXTENSIONS}
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
    </div>
  );
}
