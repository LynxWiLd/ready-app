import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { parseText, renderMarkdown, renderPlainText } from '../services/text.js';
import { excerptAround, foldForSearch, foldQuery, searchLimit } from '../utils/search.js';

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
  { blob, settings, initialScrollTop = 0, onLocation, onReady, onJump },
  ref
) {
  const scrollRef = useRef(null);
  const articleRef = useRef(null);
  const [html, setHtml] = useState('');
  const [loaded, setLoaded] = useState(false);
  const didInitialScroll = useRef(false);

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
      if (el && target?.scrollTop != null) el.scrollTo({ top: target.scrollTop, behavior: 'smooth' });
    },
    search: (query, options) =>
      searchInArticle(articleRef.current, scrollRef.current, query, options)
  }));

  const jumpRef = useRef(null);
  useEffect(() => {
    if (onJump?.scrollTop != null && jumpRef.current !== onJump) {
      jumpRef.current = onJump;
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: onJump.scrollTop, behavior: 'smooth' });
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
