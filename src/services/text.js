import { marked } from 'marked';
import DOMPurifyModule from 'dompurify';

// Normaliza el interop CJS/ESM de DOMPurify.
const DOMPurify = DOMPurifyModule && DOMPurifyModule.default ? DOMPurifyModule.default : DOMPurifyModule;

marked.setOptions({ gfm: true, breaks: true });

/** Lee un archivo de texto/Markdown y devuelve estadísticas. */
export async function parseText(blob) {
  const raw = await blob.text();
  const isMarkdown = /\.(md|markdown)$/i.test(blob.name || '');
  return {
    text: raw,
    isMarkdown,
    wordCount: countWords(raw)
  };
}

function countWords(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/** Convierte Markdown a HTML seguro (escape + sanitize). */
export function renderMarkdown(md) {
  const rawHtml = marked.parse(md || '');
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button'],
    FORBID_ATTR: ['style']
  });
}

export function renderPlainText(text) {
  const escaped = escapeHtml(text ?? '');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, '<br/>'))
    .map((p) => `<p>${p}</p>`)
    .join('');
  return paragraphs;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
