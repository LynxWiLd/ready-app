import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { TextLayer } from 'pdfjs-dist';
import { openPdf, getPdfOutline, searchPdf } from '../services/pdf.js';
import { getHighlightColor } from '../utils/highlights.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const GAP = 24;

function HighlightOverlay({ items }) {
  if (!items?.length) return null;
  return (
    <div className="pdf-highlight-layer" aria-hidden="true">
      {items.map((item) => (
        <span
          key={item.id}
          className="pdf-highlight-rect"
          style={{
            left: `${item.rect.x * 100}%`,
            top: `${item.rect.y * 100}%`,
            width: `${item.rect.w * 100}%`,
            height: `${item.rect.h * 100}%`,
            backgroundColor: item.color
          }}
        />
      ))}
    </div>
  );
}

/**
 * Lector PDF (RF-03, RNF-02).
 * Render perezoso: en modo desplazar solo se dibujan las páginas cercanas
 * a la actual; los placeholders reservan altura midiendo viewports.
 */
const PdfReader = forwardRef(function PdfReader(
  {
    blob,
    settings,
    initialPage = 1,
    onLocation,
    onReady,
    onJump,
    onSelect,
    highlights = []
  },
  ref
) {
  const containerRef = useRef(null);
  const docRef = useRef(null);
  const canvasRefs = useRef(new Map());
  const tasksRef = useRef(new Map());
  const textLayerRefs = useRef(new Map());
  const textLayersRef = useRef(new Map());
  const renderTokensRef = useRef(new Map());
  const searchCacheRef = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [outline, setOutline] = useState([]);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [zoom, setZoom] = useState(settings.pdfZoom);
  const [heights, setHeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [widthVersion, setWidthVersion] = useState(0);

  const view = settings.pdfView;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const availableWidth = useCallback(() => {
    const w = containerRef.current?.clientWidth || 800;
    return view === 'double' ? Math.max(200, w / 2 - 16) : Math.max(200, w - 32);
  }, [view]);

  // Abrir documento
  useEffect(() => {
    let alive = true;
    setLoading(true);
    openPdf(blob)
      .then(async ({ doc, numPages: n }) => {
        if (!alive) {
          doc.destroy();
          return;
        }
        const toc = await getPdfOutline(doc);
        if (!alive) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setOutline(toc);
        setNumPages(n);
        setCurrentPage(initialPage || 1);
        setLoading(false);
        onReady?.({ numPages: n, toc });
      })
      .catch((err) => {
        if (!alive) return;
        setLoading(false);
        onReady?.({ error: err?.message || 'No se pudo abrir el PDF.' });
      });
    return () => {
      alive = false;
      try {
        docRef.current?.destroy();
      } catch {
        /* noop */
      }
      docRef.current = null;
      canvasRefs.current.clear();
      tasksRef.current.clear();
      textLayerRefs.current.clear();
      for (const layer of textLayersRef.current.values()) {
        try {
          layer.cancel?.();
        } catch {
          /* noop */
        }
      }
      textLayersRef.current.clear();
      searchCacheRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  // Detectar selecciones de texto en la capa de pdf.js.
  useEffect(() => {
    let timer;

    const captureSelection = () => {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (
        !container ||
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0
      ) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;

      const startElement =
        range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : range.startContainer;
      if (!startElement?.closest?.('.pdf-text-layer')) return;

      const text = selection.toString().trim();
      if (!text) return;

      const pages = [...container.querySelectorAll('.pdf-page[data-page]')];
      const regionMap = new Map();
      let firstRect = null;

      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        let pageElement = null;
        let bodyRect = null;

        for (const candidate of pages) {
          const body = candidate.querySelector('.pdf-page-body');
          if (!body) continue;
          const box = body.getBoundingClientRect();
          if (
            rect.left < box.right &&
            rect.right > box.left &&
            rect.top < box.bottom &&
            rect.bottom > box.top
          ) {
            pageElement = candidate;
            bodyRect = box;
            break;
          }
        }

        if (!pageElement || !bodyRect || !bodyRect.width || !bodyRect.height) continue;
        const pageNum = Number(pageElement.dataset.page);
        if (!Number.isFinite(pageNum)) continue;

        const x = Math.max(0, Math.min(1, (rect.left - bodyRect.left) / bodyRect.width));
        const y = Math.max(0, Math.min(1, (rect.top - bodyRect.top) / bodyRect.height));
        const right = Math.max(0, Math.min(1, (rect.right - bodyRect.left) / bodyRect.width));
        const bottom = Math.max(0, Math.min(1, (rect.bottom - bodyRect.top) / bodyRect.height));
        const width = right - x;
        const height = bottom - y;
        if (width <= 0 || height <= 0) continue;

        if (!regionMap.has(pageNum)) regionMap.set(pageNum, []);
        regionMap.get(pageNum).push({ x, y, w: width, h: height });
        if (!firstRect) firstRect = rect;
      }

      if (regionMap.size === 0) return;
      const regions = [...regionMap.entries()]
        .map(([page, rects]) => ({ page, rects }))
        .sort((a, b) => a.page - b.page);

      onSelectRef.current?.({
        text: text.slice(0, 2000),
        page: regions[0].page,
        regions,
        rect: firstRect
          ? { x: firstRect.left, y: firstRect.top, width: firstRect.width, height: firstRect.height }
          : null,
        source: 'pdf'
      });
    };

    const onSelectionChange = () => {
      clearTimeout(timer);
      timer = setTimeout(captureSelection, 260);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, []);

  // Re-medir al cambiar el tamaño de ventana (debounced, R-04)
  useEffect(() => {
    let timer;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setWidthVersion((v) => v + 1), 180);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
    };
  }, []);

  // Medir alturas (solo modo desplazar) — no dibuja, solo viewports.
  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      const doc = docRef.current;
      if (!doc || view !== 'scroll') return;
      const avail = availableWidth();
      const next = new Array(doc.numPages).fill(600);
      for (let i = 1; i <= doc.numPages; i++) {
        try {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const s = (avail / base.width) * zoom;
          next[i - 1] = Math.ceil(page.getViewport({ scale: s }).height) + GAP;
          page.cleanup?.();
        } catch {
          next[i - 1] = 600;
        }
        if (cancelled) return;
      }
      if (!cancelled) setHeights(next);
    };
    measure();
    return () => {
      cancelled = true;
    };
  }, [numPages, view, zoom, availableWidth, widthVersion]);

  const visiblePages = useMemo(() => {
    if (!numPages) return [];
    const cur = Math.min(Math.max(1, currentPage), numPages);
    if (view === 'scroll') {
      const start = Math.max(1, cur - 2);
      const end = Math.min(numPages, cur + 2);
      const list = [];
      for (let i = start; i <= end; i++) list.push(i);
      return list;
    }
    if (view === 'double') return [cur, cur + 1].filter((p) => p >= 1 && p <= numPages);
    return [cur];
  }, [currentPage, numPages, view]);

  const highlightRectsByPage = useMemo(() => {
    const map = new Map();
    for (const highlight of highlights) {
      const color = getHighlightColor(highlight.color);
      for (const region of highlight.regions || []) {
        if (!Number.isFinite(region?.page) || !Array.isArray(region.rects)) continue;
        if (!map.has(region.page)) map.set(region.page, []);
        for (const rect of region.rects) {
          map.get(region.page).push({
            id: `${highlight.id}-${map.get(region.page).length}`,
            color: color.css,
            rect
          });
        }
      }
    }
    return map;
  }, [highlights]);

  const renderPage = useCallback(
    async (pageNum) => {
      const doc = docRef.current;
      const entry = canvasRefs.current.get(pageNum);
      if (!doc || !entry) return;

      // Evita que un render antiguo (zoom/resize) pise al actual.
      const token = (renderTokensRef.current.get(pageNum) || 0) + 1;
      renderTokensRef.current.set(pageNum, token);
      const isCurrent = () => renderTokensRef.current.get(pageNum) === token;

      const avail = availableWidth();
      const page = await doc.getPage(pageNum);
      if (!isCurrent()) return;
      const base = page.getViewport({ scale: 1 });
      const effective = (avail / base.width) * zoom;
      const cssVp = page.getViewport({ scale: effective });
      const canvas = entry;
      canvas.width = Math.floor(cssVp.width * dpr);
      canvas.height = Math.floor(cssVp.height * dpr);
      canvas.style.width = `${cssVp.width}px`;
      canvas.style.height = `${cssVp.height}px`;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const task = page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: effective * dpr }) });
      tasksRef.current.set(pageNum, task);
      let cancelled = false;
      try {
        await task.promise;
      } catch {
        cancelled = true; // cancelado o error de render
      } finally {
        tasksRef.current.delete(pageNum);
      }
      if (cancelled || !isCurrent()) return;

      // Capa de texto sobre el canvas: selección, copia y futura búsqueda.
      const textDiv = textLayerRefs.current.get(pageNum);
      if (textDiv) {
        try {
          textLayersRef.current.get(pageNum)?.cancel();
        } catch {
          /* noop */
        }
        textLayersRef.current.delete(pageNum);
        textDiv.replaceChildren();
        textDiv.style.setProperty('--scale-factor', String(effective));
        const layer = new TextLayer({
          textContentSource: page.streamTextContent({ includeMarkedContent: true, disableNormalization: true }),
          container: textDiv,
          viewport: cssVp
        });
        textLayersRef.current.set(pageNum, layer);
        try {
          await layer.render();
        } catch {
          /* capa de texto no disponible */
        }
      }

      page.cleanup?.();
    },
    [availableWidth, zoom, dpr]
  );

  // Dibujar ventana visible; cancelar tareas fuera de ella (RNF-02)
  useEffect(() => {
    if (!numPages) return;
    for (const [p, task] of tasksRef.current) {
      if (!visiblePages.includes(p)) {
        try {
          task.cancel();
        } catch {
          /* noop */
        }
        tasksRef.current.delete(p);
      }
    }
    visiblePages.forEach((p) => {
      if (canvasRefs.current.has(p)) renderPage(p);
    });
  }, [visiblePages, renderPage, widthVersion]);

  // Cancelar capas de texto de páginas que dejaron de ser visibles.
  useEffect(() => {
    for (const [p, layer] of textLayersRef.current) {
      if (!visiblePages.includes(p)) {
        try {
          layer.cancel?.();
        } catch {
          /* noop */
        }
        textLayersRef.current.delete(p);
      }
    }
  }, [visiblePages]);

  // Zoom en caliente
  useEffect(() => setZoom(settings.pdfZoom), [settings.pdfZoom]);

  /** Índice del outline activo para una página (última entrada ≤ página). */
  const tocIndexForPage = useCallback(
    (page) => {
      let index = null;
      let best = 0;
      outline.forEach((item, i) => {
        if (item.page && item.page <= page && item.page > best) {
          best = item.page;
          index = i;
        }
      });
      return index;
    },
    [outline]
  );

  const commitPage = useCallback(
    (page) => {
      const clamped = Math.min(Math.max(1, page), Math.max(1, numPages));
      setCurrentPage(clamped);
      onLocation?.({
        page: clamped,
        percent: numPages > 1 ? ((clamped - 1) / (numPages - 1)) * 100 : 0,
        tocIndex: tocIndexForPage(clamped)
      });
    },
    [numPages, onLocation, tocIndexForPage]
  );

  /** Desplaza el contenedor al tope de una página (solo modo desplazar). */
  const scrollToPage = useCallback(
    (page) => {
      if (view !== 'scroll') return;
      const el = containerRef.current;
      if (!el || heights.length === 0) return;
      const clamped = Math.min(Math.max(1, page), Math.max(1, numPages));
      let acc = 0;
      for (let i = 0; i < clamped - 1; i++) acc += heights[i] || 600;
      el.scrollTo({ top: acc, behavior: 'auto' });
    },
    [view, heights, numPages]
  );

  /** Navegación (toques laterales, teclado, marcadores): cambia Y desplaza. */
  const goToPage = useCallback(
    (page) => {
      const clamped = Math.min(Math.max(1, page), Math.max(1, numPages));
      commitPage(clamped);
      scrollToPage(clamped);
    },
    [commitPage, scrollToPage, numPages]
  );

  // Retomar la página guardada al abrir (RF-05). En modo desplazar hay que
  // scrollear una vez medidas las alturas: si no, el primer handleScroll
  // recalcula la página desde el scrollTop real y pisa la página guardada.
  const initialPageRef = useRef(initialPage || 1);
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!numPages || resumedRef.current) return;
    if (view === 'scroll' && heights.length === 0) return; // esperar a medir
    resumedRef.current = true;
    const target = Math.min(Math.max(1, initialPageRef.current), numPages);
    if (view === 'scroll') scrollToPage(target);
    commitPage(target);
  }, [numPages, heights, view, commitPage, scrollToPage]);

  // Tracking de página actual en modo desplazar
  const handleScroll = useCallback(() => {
    if (view !== 'scroll') return;
    const el = containerRef.current;
    if (!el) return;
    let acc = 0;
    for (let i = 0; i < heights.length; i++) {
      acc += heights[i] || 600;
      if (el.scrollTop + el.clientHeight * 0.45 < acc) {
        commitPage(i + 1);
        return;
      }
    }
    commitPage(numPages);
  }, [view, heights, commitPage, numPages]);

  useImperativeHandle(ref, () => ({
    next: () => goToPage(currentPage + (view === 'double' ? 2 : 1)),
    prev: () => goToPage(currentPage - (view === 'double' ? 2 : 1)),
    goTo: (target) => {
      if (target?.page) goToPage(target.page);
    },
    clearSelection: () => window.getSelection?.()?.removeAllRanges(),
    search: (query, options) =>
      searchPdf(docRef.current, query, { ...options, cache: searchCacheRef.current })
  }));

  // Saltos solicitados desde marcadores / notas
  const jumpRef = useRef(null);
  useEffect(() => {
    if (onJump?.page && jumpRef.current !== onJump) {
      jumpRef.current = onJump;
      goToPage(onJump.page);
    }
  }, [onJump, goToPage]);

  const pageWidth = availableWidth();

  return (
    <div className="relative flex h-full flex-col">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-ink-500">
          Cargando PDF…
        </div>
      )}
      <div ref={containerRef} onScroll={handleScroll} className="reader-surface flex-1 overflow-auto px-4 py-4">
        {view === 'scroll' ? (
          <div className="mx-auto" style={{ maxWidth: pageWidth + 32 }}>
            {Array.from({ length: numPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const visible = visiblePages.includes(pageNum);
              const h = heights[idx] || 600;
              return (
                <div key={pageNum} className="pdf-page" style={{ height: h }} data-page={pageNum}>
                  {visible ? (
                    <div className="pdf-page-body">
                      <canvas
                        className="pdf-page-canvas"
                        ref={(el) => {
                          if (el) canvasRefs.current.set(pageNum, el);
                          else canvasRefs.current.delete(pageNum);
                        }}
                      />
                      <div
                        className="pdf-text-layer"
                        ref={(el) => {
                          if (el) textLayerRefs.current.set(pageNum, el);
                          else textLayerRefs.current.delete(pageNum);
                        }}
                      />
                      <HighlightOverlay items={highlightRectsByPage.get(pageNum)} />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-ink-300">{pageNum}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`mx-auto flex h-full items-start justify-center gap-4 ${view === 'double' ? 'flex-row' : 'flex-col'} pt-2`}>
            {visiblePages.map((pageNum) => (
              <div key={pageNum} className="pdf-page" data-page={pageNum}>
                <div className="pdf-page-body">
                  <canvas
                    className="pdf-page-canvas"
                    ref={(el) => {
                      if (el) canvasRefs.current.set(pageNum, el);
                      else canvasRefs.current.delete(pageNum);
                    }}
                  />
                  <div
                    className="pdf-text-layer"
                    ref={(el) => {
                      if (el) textLayerRefs.current.set(pageNum, el);
                      else textLayerRefs.current.delete(pageNum);
                    }}
                  />
                  <HighlightOverlay items={highlightRectsByPage.get(pageNum)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {view !== 'scroll' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-between px-6">
          <button
            className="icon-btn pointer-events-auto bg-white/90 shadow"
            onClick={() => commitPage(currentPage - (view === 'double' ? 2 : 1))}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="pointer-events-auto rounded-full bg-ink-900/80 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {currentPage} / {numPages}
          </span>
          <button
            className="icon-btn pointer-events-auto bg-white/90 shadow"
            onClick={() => commitPage(currentPage + (view === 'double' ? 2 : 1))}
            disabled={currentPage >= numPages}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
});

export default PdfReader;
