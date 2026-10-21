import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, List, Search, SortAsc, X } from 'lucide-react';
import { useBooks } from '../hooks/useBooks.js';
import { useToasts } from '../hooks/useToasts.js';
import { useStorageEstimate } from '../hooks/useStorageEstimate.js';
import { useReaderSettings } from '../hooks/useReaderSettings.js';
import { DropZone } from '../components/DropZone.jsx';
import { BookCard } from '../components/BookCard.jsx';
import { EmptyState, SectionHeader } from '../components/EmptyState.jsx';
import { Brand, LibraryActions, StorageIndicator } from '../components/Navbar.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { ToastContainer } from '../components/Toast.jsx';
import { exportBackup, importBackup, downloadBlob } from '../services/backup.js';
import { cn } from '../utils/cn.js';

export function LibraryView({ onOpenBook }) {
  const { books, loading, importing, refresh, importFile, removeBook } = useBooks();
  const { toasts, dismiss, success, error, info } = useToasts();
  const estimate = useStorageEstimate();
  const { settings, update, reset } = useReaderSettings();

  const [view, setView] = useState('grid');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const restoreRef = useRef(null);

  const handleFiles = useCallback(
    async (files) => {
      for (const file of files) {
        try {
          await importFile(file);
          success(`«${file.name}» importado correctamente.`);
        } catch (err) {
          error(err.message || 'No se pudo importar el archivo.');
        }
      }
    },
    [importFile, success, error]
  );

  // Arrastrar y soltar global en la vista de biblioteca (RF-01)
  useEffect(() => {
    let counter = 0;
    const onDragEnter = (e) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        counter++;
        setDragActive(true);
      }
    };
    const onDragLeave = () => {
      counter = Math.max(0, counter - 1);
      if (counter === 0) setDragActive(false);
    };
    const onDragOver = (e) => e.preventDefault();
    const onDrop = (e) => {
      e.preventDefault();
      counter = 0;
      setDragActive(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) handleFiles(files);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = books;
    if (q) {
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.metadata?.description || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sort) {
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        sorted.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'progress':
        sorted.sort((a, b) => (b.progress || 0) - (a.progress || 0));
        break;
      case 'size':
        sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
        break;
      default:
        sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
    return sorted;
  }, [books, query, sort]);

  const stats = useMemo(() => {
    const total = books.length;
    const totalSize = books.reduce((acc, b) => acc + (b.size || 0), 0);
    const started = books.filter((b) => b.progress > 0 && b.progress < 100).length;
    const finished = books.filter((b) => b.progress >= 100).length;
    return { total, totalSize, started, finished };
  }, [books]);

  const onExport = useCallback(async () => {
    try {
      info('Generando respaldo…');
      const blob = await exportBackup();
      downloadBlob(blob, `ready-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      success('Respaldo exportado.');
    } catch (e) {
      error('No se pudo exportar el respaldo.');
    }
  }, [info, success, error]);

  const onRestoreFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setRestoring(true);
      try {
        const result = await importBackup(file);
        await refresh();
        success(`Respaldo restaurado: ${result.imported} libro(s).`);
      } catch (err) {
        error(err.message || 'No se pudo restaurar el respaldo.');
      } finally {
        setRestoring(false);
      }
    },
    [refresh, success, error]
  );

  return (
    <div className="min-h-full bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Brand />
          <div className="flex items-center gap-3">
            <StorageIndicator estimate={estimate} />
            <LibraryActions
              onExport={onExport}
              onImport={() => restoreRef.current?.click()}
              onRefresh={refresh}
              importing={restoring || !!importing}
            />
            <input ref={restoreRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onRestoreFile} />
            <button className="btn-ghost" onClick={() => setSettingsOpen(true)} title="Ajustes de lectura">
              Ajustes
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <SectionHeader
          title="Biblioteca"
          subtitle={
            stats.total
              ? `${stats.total} libro(s) · ${stats.started} en lectura · ${stats.finished} terminados`
              : 'Tus documentos, en tu dispositivo'
          }
          right={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  className="field pl-8"
                  placeholder="Buscar por título o autor…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select className="field w-auto" value={sort} onChange={(e) => setSort(e.target.value)} title="Ordenar">
                <option value="recent">Recientes</option>
                <option value="title">Título</option>
                <option value="author">Autor</option>
                <option value="progress">Progreso</option>
                <option value="size">Tamaño</option>
              </select>
              <div className="flex rounded-lg border border-ink-200 p-0.5">
                <button
                  className={cn('icon-btn', view === 'grid' && 'bg-ink-100 text-ink-800')}
                  onClick={() => setView('grid')}
                  title="Vista de cuadrícula"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  className={cn('icon-btn', view === 'list' && 'bg-ink-100 text-ink-800')}
                  onClick={() => setView('list')}
                  title="Vista de lista"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        />

        {!loading && books.length === 0 ? (
          <div className="space-y-4">
            <EmptyState onBrowse={() => document.getElementById('library-picker')?.click()} />
            <DropZone onFiles={handleFiles} compact inputId="library-picker" />
          </div>
        ) : (
          <div className="space-y-4">
            <DropZone onFiles={handleFiles} compact inputId="library-picker" />
            {importing && <ImportBanner importing={importing} />}
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-400">Sin resultados para «{query}».</p>
            ) : (
              <div
                className={cn(
                  view === 'grid'
                    ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                    : 'flex flex-col gap-3'
                )}
              >
                {filtered.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    view={view}
                    onOpen={() => onOpenBook(book.id)}
                    onDelete={() => setConfirmDelete(book)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-400">
          <SortAsc className="h-3.5 w-3.5" />
          Tus libros se guardan localmente en este navegador. Usa «Respaldar» para guardar una copia.
        </p>
      </main>

      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-indigo-600/10 backdrop-blur-sm">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-400 bg-white px-6 py-5 shadow-xl animate-fade-in">
            <span className="text-lg font-medium text-indigo-700">Suelta para importar</span>
            <button className="btn-ghost" onClick={() => setDragActive(false)} aria-label="Cancelar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} update={update} reset={reset} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar libro"
        message={`Se eliminará «${confirmDelete?.title}» junto con su progreso, marcadores y notas. Esta acción no se puede deshacer.`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          try {
            await removeBook(confirmDelete.id);
            success('Libro eliminado de la biblioteca.');
          } catch {
            error('No se pudo eliminar el libro.');
          } finally {
            setConfirmDelete(null);
          }
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function ImportBanner({ importing }) {
  return (
    <div className="card flex items-center gap-3 border-indigo-100 bg-indigo-50/60 px-4 py-3 animate-fade-in">
      <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-indigo-800">
          {importing.error ? 'Error al importar' : `Importando «${importing.name}»…`}
        </p>
        {importing.error ? (
          <p className="text-xs text-rose-600">{importing.error}</p>
        ) : (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-indigo-100">
            <div className="h-full rounded-full bg-indigo-500 transition-[width]" style={{ width: `${importing.percent}%` }} />
          </div>
        )}
      </div>
      {importing.warning && !importing.error && (
        <span className="chip bg-amber-100 text-amber-800">Archivo grande</span>
      )}
    </div>
  );
}
