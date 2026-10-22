import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { parseText, renderMarkdown, renderPlainText } from '../services/text.js';
import { excerptAround, foldForSearch, foldQuery, searchLimit } from '../utils/search.js';
import {
  getHighlightColorName,
  quoteFromRange,
  rangeFromOffsets,
  scrollRangeIntoView
} from '../utils/highlights.js';

/**
 * Busca coincidencias en los nodos de texto renderizados y calcula el
 * desplazamiento exacto de cada una dentro del contenedor.
 */
function searchInArticle(article, container, query, { limit = 100, signal } = {}) {
  if (!article || !container) return [];
  const q = foldQuery(query);
  if (q.length < 2) return [];

  const max = searchLimit(limit);
  const results = [];
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  let node;

  while ((node = walker.nextNode())) {
    if (signal?.aborted || results.length >= max) break;
    const raw = node.nodeValue || '';
    if (!raw.trim()) continue;
    const folded = foldForSearch(raw);
    let from = 0;

    while (results.length < max) {
      const at = folded.text.indexOf(q, from);
      if (at === -1) break;
      const start = folded.map[at];
      const end = folded.map[at + q.length - 1] + 1;
      let scrollTop = null;
      try {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        const rect = range.getBoundingClientRect();
        const base = container.getBoundingClientRect();
        if (rect.height || rect.width) {
          scrollTop = Math.max(0, container.scrollTop + rect.top - base.top - 72);
        }
      } catch {
        scrollTop = null;
      }
      let excerpt = excerptAround(raw, start, end);
      const block = node.parentElement?.closest(
        'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th'
      );
      if (block) {
        const blockText = block.textContent || '';
        const foldedBlock = foldForSearch(blockText);
        const blockAt = foldedBlock.text.indexOf(q);
        if (blockAt !== -1) {
          const blockStart = foldedBlock.map[blockAt];
          const blockEnd = foldedBlock.map[blockAt + q.length - 1] + 1;
          excerpt = excerptAround(blockText, blockStart, blockEnd);
        }
      }
      results.push({
        id: `txt-${results.length}`,
        excerpt,
        scrollTop
      });
      from = at + q.length;
    }
  }

  return results;
}

/**
 * Lector de texto plano y Markdown (RF-01, RF-03).
 */
const TextReader = forwardRef(function TextReader(
  {
    blob,
    settings,
    initialScrollTop = 0,
    onLocation,
    onReady,
    onJump,
    onSelect,
    highlights = []
  },
  ref
) {
  const scrollRef = useRef(null);
  const articleRef = useRef(null);
  const [html, setHtml] = useState('');
  const [loaded, setLoaded] = useState(false);
  const didInitialScroll = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setHtml('');
    didInitialScroll.current = false;
    (async () => {
      try {
        const parsed = await parseText(blob);
        if (!alive) return;
        setHtml(parsed.isMarkdown ? renderMarkdown(parsed.text) : renderPlainText(parsed.text));
        setLoaded(true);
      } catch (err) {
        if (alive) onReady?.({ error: err?.message || 'No se pudo leer el archivo.' });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  // Restaurar posición inicial una vez renderizado (o volver arriba al cambiar de libro)
  useEffect(() => {
    if (!loaded || didInitialScroll.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = initialScrollTop || 0;
    didInitialScroll.current = true;
  }, [loaded, initialScrollTop]);

  // Avisar cuando el DOM ya está disponible (búsqueda, spinner de carga).
  useEffect(() => {
    if (loaded) onReady?.({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Detectar selecciones de texto para proponer un resaltado.
  useEffect(() => {
    let timer;
    const onSelectionChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const article = articleRef.current;
        const container = scrollRef.current;
        const selection = window.getSelection();
        if (
          !article ||
          !container ||
          !selection ||
          selection.isCollapsed ||
          selection.rangeCount === 0
        ) {
          return;
        }
        const range = selection.getRangeAt(0);
        if (!article.contains(range.commonAncestorContainer)) return;
        const text = range.toString().trim();
        if (!text) return;
        const quote = quoteFromRange(article, range);
        if (!quote) return;

        let scrollTop = null;
        try {
          const rect = range.getBoundingClientRect();
          const base = container.getBoundingClientRect();
          if (rect.height || rect.width) {
            scrollTop = Math.max(0, container.scrollTop + rect.top - base.top - 72);
          }
        } catch {
          scrollTop = null;
        }

        onSelectRef.current?.({
          text: text.slice(0, 2000),
          quote,
          scrollTop,
          source: 'text'
        });
      }, 260);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [loaded]);

  // Pintar resaltados con la API de Highlight (sin alterar el HTML de React).
  useEffect(() => {
    if (typeof Highlight === 'undefined' || typeof CSS === 'undefined' || !CSS.highlights) {
      return undefined;
    }
    const article = articleRef.current;
    if (!article) return undefined;

    const groups = new Map();
    for (const highlight of highlights) {
      if (!highlight.quote) continue;
      const range = rangeFromOffsets(
        article,
        highlight.quote.start,
        highlight.quote.end
      );
      if (!range) continue;
      const name = getHighlightColorName(highlight.color);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(range);
    }

    const names = [];
    for (const [name, ranges] of groups) {
      const key = `ready-hl-${name}`;
      CSS.highlights.set(key, new Highlight(...ranges));
      names.push(key);
    }

    return () => {
      for (const key of names) CSS.highlights.delete(key);
    };
  }, [html, loaded, highlights]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const percent = max > 0 ? (el.scrollTop / max) * 100 : 100;
    onLocation?.({ scrollTop: el.scrollTop, percent, anchorText: '' });
  };

  useImperativeHandle(ref, () => ({
    next: () => {
      const el = scrollRef.current;
      if (el) el.scrollBy({ top: el.clientHeight * 0.85, behavior: 'smooth' });
    },
    prev: () => {
      const el = scrollRef.current;
      if (el) el.scrollBy({ top: -el.clientHeight * 0.85, behavior: 'smooth' });
    },
    goTo: (target) => {
      const el = scrollRef.current;
      if (target?.quote) {
        const range = rangeFromOffsets(
          articleRef.current,
          target.quote.start,
          target.quote.end
        );
        if (range && scrollRangeIntoView(el, range)) return;
      }
      if (el && target?.scrollTop != null) el.scrollTo({ top: target.scrollTop, behavior: 'smooth' });
    },
    clearSelection: () => window.getSelection?.()?.removeAllRanges(),
    search: (query, options) =>
      searchInArticle(articleRef.current, scrollRef.current, query, options)
  }));

  const jumpRef = useRef(null);
  useEffect(() => {
    if (!onJump || jumpRef.current === onJump) return;
    jumpRef.current = onJump;
    const el = scrollRef.current;
    if (!el) return;

    // Los resaltados guardan la cita: es más fiable que el scroll antiguo.
    if (onJump.quote) {
      const range = rangeFromOffsets(
        articleRef.current,
        onJump.quote.start,
        onJump.quote.end
      );
      if (range && scrollRangeIntoView(el, range)) return;
    }
    if (onJump.scrollTop != null) {
      el.scrollTo({ top: onJump.scrollTop, behavior: 'smooth' });
    }
  }, [onJump]);

  const fontClass = settings.font === 'serif' ? 'font-serif' : settings.font === 'mono' ? 'font-mono' : 'font-sans';

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={`reader-surface theme-${settings.theme} ${fontClass}`}
      style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
    >
      <article
        ref={articleRef}
        className="reader-markdown mx-auto"
        style={{ maxWidth: `${settings.maxWidth}px`, padding: `${settings.margin}px ${Math.max(settings.margin, 24)}px` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
});

export default TextReader;
