import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import ePub from 'epubjs';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { buildTocList, buildTocIndex, searchEpub } from '../services/epub.js';

const FONT_STACKS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
};

const THEME_COLORS = {
  light: { bg: '#ffffff', fg: '#1f2937', accent: '#4f46e5', muted: '#6b7280' },
  dark: { bg: '#111827', fg: '#e5e7eb', accent: '#818cf8', muted: '#9ca3af' },
  sepia: { bg: '#f5eddc', fg: '#43331f', accent: '#a16207', muted: '#7a6749' }
};

function buildThemeCSS(settings) {
  const t = THEME_COLORS[settings.theme] || THEME_COLORS.light;
  const font = FONT_STACKS[settings.font] || FONT_STACKS.sans;
  return [
    `html, body { background: ${t.bg} !important; color: ${t.fg} !important; }`,
    `body { font-family: ${font} !important; font-size: ${settings.fontSize}px !important; line-height: ${settings.lineHeight} !important; }`,
    `body { padding-left: ${settings.margin}px !important; padding-right: ${settings.margin}px !important; box-sizing: border-box; }`,
    `a { color: ${t.accent} !important; }`,
    `p, div, span, li, h1, h2, h3, h4, h5, h6 { color: ${t.fg} !important; }`,
    `img { max-width: 100% !important; height: auto !important; }`,
    `table, th, td { border-color: ${t.muted} !important; }`
  ].join('\n');
}

/**
 * Lector EPUB fluido (RF-03, RF-04, RF-05).
 * Expone next/prev/goTo y notifica la posición actual.
 */
const EpubReader = forwardRef(function EpubReader(
  { blob, settings, initialCfi, onLocation, onReady, onJump },
  ref
) {
  const containerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const readyRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const applySettings = useCallback((rendition, s) => {
    if (!rendition) return;
    try {
      rendition.themes.register('reader-theme', buildThemeCSS(s));
      rendition.themes.select('reader-theme');
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let book;
    let tocList = [];
    const tocIndexBySpine = new Map();

    const init = async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        if (cancelled) return;
        book = ePub(arrayBuffer);
        bookRef.current = book;
        const rendition = book.renderTo(containerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
          minSpreadWidth: 900,
          allowScriptedContent: true
        });
        renditionRef.current = rendition;

        // TOC navegable (awaited junto con el resto de la carga)
        try {
          const navigation = await book.loaded.navigation;
          tocList = await buildTocList(book, navigation);
          for (const [key, index] of buildTocIndex(tocList)) tocIndexBySpine.set(key, index);
        } catch {
          tocList = [];
        }

        rendition.on('locationChanged', (loc) => {
          if (typeof window !== 'undefined') window.__epubLoc = loc;
          if (!readyRef.current) return;
          const spineLength = book.spine?.length || 1;
          const index = loc?.index ?? 0;
          const indexPercent = Math.min(100, (index / Math.max(1, spineLength - 1)) * 100);
          const percent =
            typeof loc?.percentage === 'number' && loc.percentage > 0
              ? loc.percentage * 100
              : indexPercent;
          const cfi = loc?.start || null;
          let anchorText = '';
          try {
            const range = rendition.getRange(cfi);
            anchorText = (range?.toString() || '').slice(0, 200);
          } catch {
            anchorText = '';
          }
          const tocIndex =
            loc?.index != null && tocIndexBySpine.has(loc.index) ? tocIndexBySpine.get(loc.index) : null;
          onLocation?.({ cfi, percent, anchorText, tocIndex });
        });

        applySettings(rendition, settingsRef.current);
        if (initialCfi) {
          await rendition.display(initialCfi);
        } else {
          await rendition.display();
        }
        if (cancelled) return;
        readyRef.current = true;
        onReady?.({ spineCount: book.spine?.length || 0, toc: tocList });
      } catch (err) {
        if (!cancelled) onReady?.({ error: err?.message || 'No se pudo abrir el EPUB.' });
      }
    };

    init();
    return () => {
      cancelled = true;
      readyRef.current = false;
      try {
        renditionRef.current?.destroy();
      } catch {
        /* noop */
      }
      try {
        book?.destroy();
      } catch {
        /* noop */
      }
      renditionRef.current = null;
      bookRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  // Aplicar cambios de estilo en caliente
  useEffect(() => {
    applySettings(renditionRef.current, settings);
  }, [settings, applySettings]);

  useImperativeHandle(ref, () => ({
    next: () => renditionRef.current?.next()?.catch?.(() => {}),
    prev: () => renditionRef.current?.prev()?.catch?.(() => {}),
    goTo: (target) => {
      const destination = target?.cfi || target?.href;
      if (destination && renditionRef.current) {
        return renditionRef.current.display(destination).catch(() => {});
      }
      return Promise.resolve();
    },
    search: (query, options) => searchEpub(bookRef.current, query, options),
    getCurrent: () => renditionRef.current?.currentLocation?.() || null
  }));

  // Responder a saltos solicitados (marcadores/notas/TOC)
  const jump = useDebouncedValue(onJump, 120);
  useEffect(() => {
    const destination = jump?.cfi || jump?.href;
    if (destination && renditionRef.current) {
      renditionRef.current.display(destination).catch(() => {});
    }
  }, [jump]);

  return <div ref={containerRef} className="h-full w-full" />;
});

export default EpubReader;
