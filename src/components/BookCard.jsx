import { useRef } from 'react';
import { BookOpen, Trash2, ImagePlus, ImageOff } from 'lucide-react';
import { CoverImage } from './CoverImage.jsx';
import { ProgressBar } from './ProgressBar.jsx';
import { FORMAT_LABELS } from '../services/db.js';
import { formatBytes, formatDateTime, truncate } from '../utils/format.js';

export function BookCard({ book, view = 'grid', onOpen, onDelete, onCoverFile, onCoverClear }) {
  const meta = book.metadata || {};
  const cover = book.cover;

  if (view === 'list') {
    return (
      <article className="card flex items-center gap-4 p-3 transition hover:shadow-md">
        <button className="h-20 w-14 shrink-0 overflow-hidden rounded-md" onClick={onOpen} aria-label={`Abrir ${book.title}`}>
          <CoverImage data={cover} type={book.coverType} className="h-full w-full" alt={book.title} />
        </button>
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-2">
            <span className="chip bg-ink-100 text-ink-600">{FORMAT_LABELS[book.format] || book.format.toUpperCase()}</span>
            <span className="text-[11px] text-ink-400">{formatBytes(book.size)}</span>
          </div>
          <h3 className="mt-1 truncate font-semibold text-ink-800">{book.title}</h3>
          <p className="truncate text-sm text-ink-500">{book.author}</p>
          <div className="mt-2 max-w-xs">
            <ProgressBar value={book.progress} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-ink-400">{formatDateTime(book.lastOpenedAt)}</span>
          <BookMenu book={book} onDelete={onDelete} onCoverFile={onCoverFile} onCoverClear={onCoverClear} />
        </div>
      </article>
    );
  }

  return (
    <article className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <button className="relative aspect-[2/3] w-full overflow-hidden bg-ink-100" onClick={onOpen} aria-label={`Abrir ${book.title}`}>
        {cover ? (
          <CoverImage data={cover} type={book.coverType} className="h-full w-full transition group-hover:scale-[1.03]" alt={book.title} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-50 to-cyan-50 p-4 text-center">
            <BookOpen className="h-8 w-8 text-indigo-300" />
            <span className="line-clamp-3 text-xs font-medium text-ink-500">{truncate(book.title, 60)}</span>
          </div>
        )}
        <span className="absolute left-2 top-2 chip bg-white/90 text-ink-700 shadow-sm backdrop-blur">
          {FORMAT_LABELS[book.format] || book.format.toUpperCase()}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-ink-800" title={book.title}>
          {book.title}
        </h3>
        <p className="truncate text-xs text-ink-500">{book.author}</p>
        <div className="mt-auto pt-2">
          <ProgressBar value={book.progress} showLabel />
        </div>
        {meta.spineCount != null && <p className="text-[11px] text-ink-400">{meta.spineCount} páginas</p>}
      </div>

      <div className="absolute right-2 top-8 opacity-0 transition group-hover:opacity-100">
        <BookMenu book={book} onDelete={onDelete} onCoverFile={onCoverFile} onCoverClear={onCoverClear} />
      </div>
    </article>
  );
}

function BookMenu({ book, onDelete, onCoverFile, onCoverClear }) {
  const coverInputRef = useRef(null);

  return (
    <div className="relative flex items-center gap-1">
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onCoverFile?.(file);
        }}
      />
      <button
        className="icon-btn h-7 w-7 bg-white/90 shadow-sm backdrop-blur"
        onClick={(e) => {
          e.stopPropagation();
          coverInputRef.current?.click();
        }}
        title="Elegir portada"
        aria-label="Elegir portada"
      >
        <ImagePlus className="h-3.5 w-3.5 text-indigo-500" />
      </button>
      {book?.cover && (
        <button
          className="icon-btn h-7 w-7 bg-white/90 shadow-sm backdrop-blur"
          onClick={(e) => {
            e.stopPropagation();
            onCoverClear?.();
          }}
          title="Quitar portada"
          aria-label="Quitar portada"
        >
          <ImageOff className="h-3.5 w-3.5 text-ink-500" />
        </button>
      )}
      <button
        className="icon-btn h-7 w-7 bg-white/90 shadow-sm backdrop-blur"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
        title="Eliminar libro"
        aria-label="Eliminar libro"
      >
        <Trash2 className="h-4 w-4 text-rose-500" />
      </button>
    </div>
  );
}
