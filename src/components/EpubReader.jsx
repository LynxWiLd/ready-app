import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ePub from 'epubjs';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { buildTocList, buildTocIndex, searchEpub } from '../services/epub.js';
import { getHighlightColor, getHighlightColorName } from '../utils/highlights.js';

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

/**
 * Margen lateral del EPUB.
 *
 * epub.js no deja el `padding` del body en manos del CSS: al paginar escribe
 * `padding-left/right` en línea con `!important` a partir del `gap` de la
 * maquetación (cada lado recibe gap/2). Un `!important` en línea gana a
 * cualquier hoja de estilos, así que el margen se configura con el gap y no
 * con reglas CSS, que quedarían muertas.
 */
function gapForMargin(margin) {
  return Math.max(0, margin) * 2;
}

function buildThemeCSS(settings) {
  const t = THEME_COLORS[settings.theme] || THEME_COLORS.light;
  const font = FONT_STACKS[settings.font] || FONT_STACKS.sans;
  return [
    `html, body { background: ${t.bg} !important; color: ${t.fg} !important; }`,
    `body { font-family: ${font} !important; font-size: ${settings.fontSize}px !important; line-height: ${settings.lineHeight} !important; }`,
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
  { blob, settings, initialCfi, onLocation, onReady, onJump, onSelect, highlights = [] },
  ref
) {
  const containerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const readyRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const appliedHighlightsRef = useRef(new Map());
  const [renditionReady, setRenditionReady] = useState(false);

  const applySettings = useCallback((rendition, s) => {
    if (!rendition) return;
    try {
      // OJO: themes.register('x', css) interpreta el CSS como URL en epub.js
      // 0.3.93: acaba inyectando <link href="http://…/html,%20body%20{…}">, que
      // no carga y deja el libro sin tema ni tipografía. registerCss usa un
      // <style> y reemplaza el anterior en cada cambio.
      rendition.themes.registerCss('reader-theme', buildThemeCSS(s));
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
    setRenditionReady(false);

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

        // El margen se aplica por el gap de la maquetación (ver gapForMargin).
        if (rendition.manager?.settings) {
          rendition.manager.settings.gap = gapForMargin(settingsRef.current.margin);
        }

        // `Themes.inject()` sólo reinyecta temas con `rules`/`url`, no los
        // registrados con `registerCss`: cada `contents` nuevo (cambio de
        // capítulo, re-maquetación al mover el ancho) nace con la clase pero
        // sin la hoja de estilos. Reaplicar en `rendered` mantiene el tema.
        rendition.on('rendered', () => {
          applySettings(rendition, settingsRef.current);
        });

        // Selección de texto dentro del iframe: propone crear un resaltado.
        rendition.on('selected', (cfiRange, contents) => {
          let text = '';
          let rect = null;
          try {
            const selection = contents.window.getSelection();
            text = selection?.toString() || '';
            const range =
              selection && selection.rangeCount > 0
                ? selection.getRangeAt(0)
                : contents.range(cfiRange);
            const r = range?.getBoundingClientRect();
            const frame = contents.document?.defaultView?.frameElement?.getBoundingClientRect();
            if (r && frame) {
              rect = {
                x: frame.left + r.left,
                y: frame.top + r.top,
                width: r.width,
                height: r.height
              };
            }
          } catch {
            /* selección no disponible */
          }
          text = text.trim();
          if (!text) return;
          onSelectRef.current?.({
            text: text.slice(0, 2000),
            cfi: cfiRange,
            rect,
            source: 'epub'
          });
        });

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
        setRenditionReady(true);
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
      appliedHighlightsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  // Sincronizar resaltados con las anotaciones internas de epub.js.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !renditionReady) return;

    const applied = appliedHighlightsRef.current;

    for (const [id, entry] of applied) {
      const current = highlights.find((h) => h.id === id);
      if (!current || current.cfi !== entry.cfi) {
        try {
          rendition.annotations.remove(entry.cfi, 'highlight');
        } catch {
          /* noop */
        }
        applied.delete(id);
      }
    }

    for (const highlight of highlights) {
      if (!highlight.cfi) continue;
      const colorName = getHighlightColorName(highlight.color);
      const current = applied.get(highlight.id);
      if (current && current.cfi === highlight.cfi && current.color === colorName) continue;

      if (current) {
        try {
          rendition.annotations.remove(current.cfi, 'highlight');
        } catch {
          /* noop */
        }
        applied.delete(highlight.id);
      }

      try {
        const color = getHighlightColor(colorName);
        rendition.annotations.highlight(
          highlight.cfi,
          { id: highlight.id },
          undefined,
          `ready-hl-${colorName}`,
          { fill: color.hex, 'fill-opacity': '0.45', 'mix-blend-mode': 'multiply' }
        );
        applied.set(highlight.id, { cfi: highlight.cfi, color: colorName });
      } catch {
        /* CFI no representable en este capítulo */
      }
    }
  }, [highlights, renditionReady]);

  // Aplicar cambios de estilo en caliente
  useEffect(() => {
    applySettings(renditionRef.current, settings);
  }, [settings, applySettings]);

  // Ancho de línea y márgenes cambian la caja de paginación.
  // - El margen vive en el gap de la maquetación: `updateLayout()` reformatea
  //   las vistas existentes sin recargar los iframes (conserva el tema).
  // - El ancho sí cambia el tamaño del stage: `resize()` recrea las vistas, y
  //   el manejador de `rendered` vuelve a inyectar el tema.
  useEffect(() => {
    if (!renditionReady) return undefined;
    const id = requestAnimationFrame(() => {
      const manager = renditionRef.current?.manager;
      if (!manager) return;
      try {
        manager.settings.gap = gapForMargin(settings.margin);
        manager.updateLayout?.();
        // No-op si el ancho del contenedor no cambió.
        manager.resize?.();
      } catch {
        /* noop */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [settings.maxWidth, settings.margin, renditionReady]);

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
    clearSelection: () => {
      try {
        renditionRef.current?.getContents?.().forEach((contents) => {
          contents.window?.getSelection?.()?.removeAllRanges();
        });
      } catch {
        /* noop */
      }
    },
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

  return (
    <div className={`reader-surface theme-${settings.theme}`}>
      {/* El ancho de línea se aplica al contenedor: epub.js pagina midiendo
          esta caja, así que el iframe hereda el ancho correcto. */}
      <div
        ref={containerRef}
        className="mx-auto h-full"
        style={{ maxWidth: `${settings.maxWidth}px` }}
      />
    </div>
  );
});

export default EpubReader;
