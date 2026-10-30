import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Highlighter,
  Settings2,
  AlertTriangle,
  Loader2,
  Eye,
  ListTree,
  Search
} from 'lucide-react';
import { getBook, getProgress, saveProgress as saveProgressDb, touchOpened } from '../services/db.js';
import { scheduleReminderSync } from '../services/reminders.js';
import {
  listBookmarks,
  addBookmark,
  removeBookmark,
  listNotes,
  addNote
} from '../services/bookmarks.js';
import { listHighlights, addHighlight } from '../services/highlights.js';
import { useReaderSettings } from '../hooks/useReaderSettings.js';
import { useToasts } from '../hooks/useToasts.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import EpubReader from '../components/EpubReader.jsx';
import PdfReader from '../components/PdfReader.jsx';
import TextReader from '../components/TextReader.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { BookmarksPanel } from '../components/BookmarksPanel.jsx';
import { AnnotationsPanel } from '../components/AnnotationsPanel.jsx';
import { SelectionToolbar } from '../components/SelectionToolbar.jsx';
import { TocPanel } from '../components/TocPanel.jsx';
import { SearchPanel } from '../components/SearchPanel.jsx';
import { ToastContainer } from '../components/Toast.jsx';
import { formatPercent } from '../utils/format.js';

const FORMAT_LABELS = { epub: 'EPUB', pdf: 'PDF', txt: 'TXT', md: 'Markdown' };

export function ReaderView() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { settings, update, reset } = useReaderSettings();
  const { toasts, dismiss, success, error: toastError } = useToasts();

  const [book, setBook] = useState(null);
  const [progress, setProgress] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [panel, setPanel] = useState(null); // 'toc' | 'search' | 'bookmarks' | 'annotations' | 'settings'
  const [highlights, setHighlights] = useState([]);
  const [selection, setSelection] = useState(null);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [toc, setToc] = useState([]);
  const [activeTocIndex, setActiveTocIndex] = useState(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [positionLabel, setPositionLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 350);

  const readerRef = useRef(null);
  const locationRef = useRef({});
  const saveTimer = useRef(null);
  const hideTimer = useRef(null);
  const [jump, setJump] = useState(null);

  // ---------------- Carga ----------------
  useEffect(() => {
    let alive = true;
    setReady(false);
    setLoadError(null);
    setToc([]);
    setActiveTocIndex(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
    setSearchError(null);
    setHighlights([]);
    setSelection(null);
    setSavingHighlight(false);
    setPanel(null);
    (async () => {
      try {
        // El progreso se carga ANTES de montar el lector: los readers reciben
        // initialPage/initialCfi correctos en el primer render (RF-05).
        const [b, p] = await Promise.all([getBook(bookId), getProgress(bookId)]);
        if (!alive) return;
        if (!b) {
          setLoadError('No se encontró el libro en la biblioteca.');
          return;
        }
        setBook(b);
        if (alive) setProgress(p || null);
        const [bm, nt, hl] = await Promise.all([
          listBookmarks(bookId),
          listNotes(bookId),
          listHighlights(bookId)
        ]);
        if (!alive) return;
        setBookmarks(bm);
        setNotes(nt);
        setHighlights(hl);
        touchOpened(bookId).catch(() => {});
      } catch (e) {
        if (alive) setLoadError(e?.message || 'Error al cargar el libro.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [bookId]);

  // ---------------- Persistencia (RF-05) ----------------
  const persist = useCallback(
    async (loc) => {
      if (!book) return;
      try {
        await saveProgressDb({
          bookId: book.id,
          cfi: loc.cfi ?? null,
          page: loc.page ?? null,
          scrollTop: loc.scrollTop ?? null,
          percent: loc.percent ?? 0
        });
        // Mantiene al día el libro en curso para el recordatorio.
        scheduleReminderSync();
      } catch {
        /* almacenamiento no disponible */
      }
    },
    [book]
  );

  const handleLocation = useCallback(
    (loc) => {
      locationRef.current = loc;
      const pct = Math.round(loc.percent || 0);
      setPositionLabel(
        loc.page ? `Pág. ${loc.page}` : loc.cfi ? `${pct}%` : loc.percent != null ? `${pct}%` : ''
      );
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(loc), 400);
      const tocIndex = loc.tocIndex ?? null;
      setActiveTocIndex((prev) => (prev === tocIndex ? prev : tocIndex));
    },
    [persist]
  );

  const cancelSelection = useCallback(() => {
    setSelection(null);
    readerRef.current?.clearSelection?.();
  }, []);

  // ---------------- Búsqueda dentro del libro ----------------
  useEffect(() => {
    if (panel !== 'search' || !ready) return undefined;
    const q = debouncedSearch.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      setSearchError(null);
      return undefined;
    }

    const controller = new AbortController();
    let alive = true;
    setSearching(true);
    setSearchError(null);

    (async () => {
      try {
        const found = await readerRef.current?.search?.(q, { signal: controller.signal });
        if (!alive || controller.signal.aborted) return;
        setSearchResults(Array.isArray(found) ? found : []);
      } catch (err) {
        if (!alive || controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(err?.message || 'No se pudo buscar en el libro.');
      } finally {
        if (alive && !controller.signal.aborted) setSearching(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [panel, ready, debouncedSearch, book?.id]);

  // Vaciar al salir / desmontar
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const loc = locationRef.current;
      if (loc && Object.keys(loc).length) persist(loc);
    };
  }, [persist]);

  // ---------------- Navegación por teclado (RF-03) ----------------
  useEffect(() => {
    const onKey = (e) => {
      // Ctrl/⌘+F abre la búsqueda interna (nunca el buscador del navegador).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setUiVisible(true);
        setSelection(null);
        readerRef.current?.clearSelection?.();
        setPanel('search');
        return;
      }
      if (e.key === 'Escape' && selection) {
        e.preventDefault();
        cancelSelection();
        return;
      }
      if (e.key === 'Escape' && panel) {
        e.preventDefault();
        setPanel(null);
        return;
      }

      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (selection) cancelSelection();
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          readerRef.current?.next?.();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          readerRef.current?.prev?.();
          break;
        case 'Home':
          readerRef.current?.goTo?.({ page: 1, scrollTop: 0 });
          break;
        case 'End':
          readerRef.current?.goTo?.({ page: 1e9 });
          break;
        case 'Escape':
          navigate('/');
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, panel, selection, cancelSelection]);

  // ---------------- UI auto-ocultable ----------------
  useEffect(() => {
    if (!settings.autoHideUI) {
      setUiVisible(true);
      return undefined;
    }
    const show = () => {
      setUiVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setUiVisible(false), 3000);
    };
    show();
    window.addEventListener('mousemove', show);
    window.addEventListener('mousedown', show);
    window.addEventListener('keydown', show);
    return () => {
      window.removeEventListener('mousemove', show);
      window.removeEventListener('mousedown', show);
      window.removeEventListener('keydown', show);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [settings.autoHideUI]);

  // ---------------- Marcadores, notas y resaltados (RF-05) ----------------
  const refreshBookmarks = useCallback(async () => setBookmarks(await listBookmarks(bookId)), [bookId]);
  const refreshNotes = useCallback(async () => setNotes(await listNotes(bookId)), [bookId]);
  const refreshHighlights = useCallback(
    async () => setHighlights(await listHighlights(bookId)),
    [bookId]
  );
  const refreshAnnotations = useCallback(async () => {
    const [nextNotes, nextHighlights] = await Promise.all([
      listNotes(bookId),
      listHighlights(bookId)
    ]);
    setNotes(nextNotes);
    setHighlights(nextHighlights);
  }, [bookId]);

  const handleSelect = useCallback((nextSelection) => {
    if (!nextSelection?.text) return;
    setSelection(nextSelection);
    setPanel(null);
  }, []);

  const handleSaveHighlight = useCallback(
    async ({ color, note }) => {
      if (!selection || !book) return;
      setSavingHighlight(true);
      try {
        await addHighlight({
          bookId: book.id,
          text: selection.text,
          note,
          color,
          cfi: selection.cfi || null,
          page: selection.page || null,
          regions: selection.regions || null,
          quote: selection.quote || null,
          scrollTop: selection.scrollTop ?? null
        });
        await refreshHighlights();
        setSelection(null);
        readerRef.current?.clearSelection?.();
        success('Resaltado guardado.');
      } catch {
        toastError('No se pudo guardar el resaltado.');
      } finally {
        setSavingHighlight(false);
      }
    },
    [selection, book, refreshHighlights, success, toastError]
  );

  const handleAddBookmark = useCallback(
    async (label) => {
      const loc = locationRef.current;
      try {
        await addBookmark({
          bookId,
          label,
          cfi: loc.cfi,
          page: loc.page,
          scrollTop: loc.scrollTop,
          anchorText: loc.anchorText
        });
        await refreshBookmarks();
        success('Marcador añadido.');
      } catch {
        toastError('No se pudo añadir el marcador.');
      }
    },
    [bookId, refreshBookmarks, success, toastError]
  );

  const handleAddNote = useCallback(
    async (content) => {
      const loc = locationRef.current;
      try {
        await addNote({
          bookId,
          content,
          cfi: loc.cfi,
          page: loc.page,
          scrollTop: loc.scrollTop,
          anchorText: loc.anchorText
        });
        await refreshNotes();
        success('Nota guardada.');
      } catch {
        toastError('No se pudo guardar la nota.');
      }
    },
    [bookId, refreshNotes, success, toastError]
  );

  const jumpToItem = useCallback(
    (item) => {
      setPanel(null);
      setSelection(null);
      setUiVisible(true);
      readerRef.current?.clearSelection?.();
      const target = {
        cfi: item.cfi,
        href: item.href,
        page: item.page,
        quote: item.quote,
        scrollTop: item.scrollTop,
        token: Date.now()
      };
      setJump(target);
      // Para EPUB, EpubReader observa `jump`; para PDF/Text, su propio efecto.
      readerRef.current?.goTo?.(target);
    },
    []
  );

  // ---------------- Render ----------------
  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-ink-50 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-rose-500" />
        <div>
          <h1 className="text-lg font-semibold text-ink-800">No se pudo abrir el documento</h1>
          <p className="mt-1 text-sm text-ink-500">{loadError}</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/')}>
          Volver a la biblioteca
        </button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-50 text-sm text-ink-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando libro…
      </div>
    );
  }

  const themeClass = `theme-${settings.theme}`;
  const percent = Math.round(progress?.percent || 0);
  const initial = {
    cfi: progress?.cfi,
    page: progress?.page,
    scrollTop: progress?.scrollTop
  };

  return (
    <div className={`h-full w-full ${themeClass}`}>
      {/* Barra superior */}
      <div
        className={`reader-toolbar fixed inset-x-0 top-0 z-40 flex items-center gap-2 px-3 py-2 transition-transform duration-200 sm:px-4 ${
          uiVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <button className="reader-tool-btn" onClick={() => navigate('/')} title="Volver a la biblioteca">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{book.title}</p>
          <p className="truncate text-xs opacity-70">
            {book.author} · {FORMAT_LABELS[book.format]}
            {positionLabel ? ` · ${positionLabel}` : percent ? ` · ${formatPercent(percent)}` : ''}
          </p>
        </div>
        <button
          className={`reader-tool-btn ${panel === 'search' ? 'is-active' : ''}`}
          onClick={() => setPanel(panel === 'search' ? null : 'search')}
          title="Buscar en el libro"
        >
          <Search className="h-5 w-5" />
        </button>
        {toc.length > 0 && (
          <button
            className={`reader-tool-btn ${panel === 'toc' ? 'is-active' : ''}`}
            onClick={() => setPanel(panel === 'toc' ? null : 'toc')}
            title="Tabla de contenidos"
          >
            <ListTree className="h-5 w-5" />
          </button>
        )}
        <button
          className={`reader-tool-btn ${panel === 'bookmarks' ? 'is-active' : ''}`}
          onClick={() => setPanel(panel === 'bookmarks' ? null : 'bookmarks')}
          title="Marcadores"
        >
          <Bookmark className="h-5 w-5" />
        </button>
        <button
          className={`reader-tool-btn ${panel === 'annotations' ? 'is-active' : ''}`}
          onClick={() => setPanel(panel === 'annotations' ? null : 'annotations')}
          title="Anotaciones"
        >
          <Highlighter className="h-5 w-5" />
        </button>
        <button
          className="reader-tool-btn"
          onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
          title="Ajustes de lectura"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </div>

      {/* Zona de lectura */}
      <div className="relative h-full pt-12">
        {!ready && !loadError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin opacity-50" />
          </div>
        )}

        <div className="relative h-full">
          {book.format === 'epub' && (
            <EpubReader
              ref={readerRef}
              blob={book.blob}
              settings={settings}
              initialCfi={initial.cfi}
              highlights={highlights}
              onSelect={handleSelect}
              onLocation={handleLocation}
              onJump={jump}
              onReady={(info) => {
                if (info?.error) setLoadError(info.error);
                setToc(Array.isArray(info?.toc) ? info.toc : []);
                setReady(true);
              }}
            />
          )}
          {book.format === 'pdf' && (
            <PdfReader
              ref={readerRef}
              blob={book.blob}
              settings={settings}
              initialPage={initial.page || 1}
              highlights={highlights}
              onSelect={handleSelect}
              onLocation={handleLocation}
              onJump={jump}
              onReady={(info) => {
                if (info?.error) setLoadError(info.error);
                setToc(Array.isArray(info?.toc) ? info.toc : []);
                setReady(true);
              }}
            />
          )}
          {(book.format === 'txt' || book.format === 'md') && (
            <TextReader
              ref={readerRef}
              blob={book.blob}
              settings={settings}
              initialScrollTop={initial.scrollTop || 0}
              highlights={highlights}
              onSelect={handleSelect}
              onLocation={handleLocation}
              onJump={jump}
              onReady={(info) => {
                if (info?.error) setLoadError(info.error);
                setReady(true);
              }}
            />
          )}

          {/* Zonas de clic para pasar página (RF-03) */}
          {!panel && !selection && (
            <>
              <button
                className={`absolute inset-y-0 left-0 z-10 w-[18%] transition-opacity ${
                  uiVisible ? 'opacity-0 hover:opacity-100' : 'opacity-0'
                }`}
                onClick={() => readerRef.current?.prev?.()}
                aria-label="Página anterior"
              />
              <button
                className={`absolute inset-y-0 right-0 z-10 w-[18%] transition-opacity ${
                  uiVisible ? 'opacity-0 hover:opacity-100' : 'opacity-0'
                }`}
                onClick={() => readerRef.current?.next?.()}
                aria-label="Página siguiente"
              />
            </>
          )}
        </div>

        {/* Panel lateral */}
        {panel && (
          <aside className="absolute inset-y-0 right-0 z-30 w-full max-w-sm border-l border-ink-100 bg-white shadow-2xl animate-slide-up">
            {panel === 'search' && (
              <SearchPanel
                query={searchQuery}
                onQueryChange={setSearchQuery}
                results={searchResults}
                searching={searching}
                error={searchError}
                onJump={jumpToItem}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === 'toc' && (
              <TocPanel
                toc={toc}
                activeIndex={activeTocIndex}
                onJump={jumpToItem}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === 'bookmarks' && (
              <BookmarksPanel
                bookmarks={bookmarks}
                onAdd={handleAddBookmark}
                onJump={jumpToItem}
                onRemove={async (id) => {
                  await removeBookmark(id);
                  await refreshBookmarks();
                }}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === 'annotations' && (
              <AnnotationsPanel
                highlights={highlights}
                notes={notes}
                onAddNote={handleAddNote}
                onJump={jumpToItem}
                onChanged={refreshAnnotations}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === 'settings' && (
              <div className="h-full overflow-y-auto p-4">
                <SettingsPanel
                  open
                  onClose={() => setPanel(null)}
                  settings={settings}
                  update={update}
                  reset={reset}
                  appSettings={false}
                />
              </div>
            )}
          </aside>
        )}
      </div>

      <button
        className={`reader-tool-btn fixed bottom-3 right-3 z-40 rounded-full bg-black/30 p-2 backdrop-blur ${
          uiVisible ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={() => setUiVisible(true)}
        title="Mostrar controles"
      >
        <Eye className="h-5 w-5" />
      </button>

      <SelectionToolbar
        selection={selection}
        saving={savingHighlight}
        onSave={handleSaveHighlight}
        onCancel={cancelSelection}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
