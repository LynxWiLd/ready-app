import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { parseText, renderMarkdown, renderPlainText } from '../services/text.js';

/**
 * Lector de texto plano y Markdown (RF-01, RF-03).
 */
const TextReader = forwardRef(function TextReader(
  { blob, settings, initialScrollTop = 0, onLocation, onReady, onJump },
  ref
) {
  const scrollRef = useRef(null);
  const [html, setHtml] = useState('');
  const [loaded, setLoaded] = useState(false);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    let alive = true;
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

  // Restaurar posición inicial una vez renderizado
  useEffect(() => {
    if (loaded && !didInitialScroll.current && initialScrollTop && scrollRef.current) {
      scrollRef.current.scrollTop = initialScrollTop;
      didInitialScroll.current = true;
    }
  }, [loaded, initialScrollTop]);

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
    }
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
        className="reader-markdown mx-auto"
        style={{ maxWidth: `${settings.maxWidth}px`, padding: `${settings.margin}px ${Math.max(settings.margin, 24)}px` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
});

export default TextReader;
