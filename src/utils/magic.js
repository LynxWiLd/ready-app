/**
 * Detección de formato por *magic numbers* y extensión.
 * R-02: validar cabeceras antes de procesar el archivo.
 */

const BINARY_SIGNATURES = [
  { format: 'pdf', label: 'PDF', mime: 'application/pdf', check: (b) => str(b, 0, 5) === '%PDF-' },
  { format: 'epub', label: 'EPUB', mime: 'application/epub+zip', check: (b) => str(b, 0, 4) === 'PK\u0003\u0004' }
];

const EXT_MAP = {
  pdf: { format: 'pdf', label: 'PDF', mime: 'application/pdf' },
  epub: { format: 'epub', label: 'EPUB', mime: 'application/epub+zip' },
  md: { format: 'md', label: 'Markdown', mime: 'text/markdown' },
  markdown: { format: 'md', label: 'Markdown', mime: 'text/markdown' },
  txt: { format: 'txt', label: 'Texto plano', mime: 'text/plain' },
  text: { format: 'txt', label: 'Texto plano', mime: 'text/plain' },
  log: { format: 'txt', label: 'Texto plano', mime: 'text/plain' }
};

function str(bytes, start, len) {
  let out = '';
  for (let i = start; i < Math.min(start + len, bytes.length); i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function isLikelyText(bytes) {
  const sample = bytes.slice(0, 512);
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127) || byte >= 128) printable++;
  }
  return sample.length > 0 && printable / sample.length > 0.85;
}

/** Lee los primeros N bytes de un File/Blob. */
export async function readHeader(blob, bytes = 1024) {
  const slice = blob.slice(0, bytes);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Detecta el formato del archivo.
 * @returns {{format: 'pdf'|'epub'|'txt'|'md', label: string, mime: string}|null}
 */
export async function detectFormat(file) {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  const header = await readHeader(file);

  // 1) Extensión conocida: se confía en ella (el parser valida el contenido real).
  if (EXT_MAP[ext]) return EXT_MAP[ext];

  // 2) Firma binaria (por si el archivo fue renombrado).
  for (const sig of BINARY_SIGNATURES) {
    if (sig.check(header)) return { format: sig.format, label: sig.label, mime: sig.mime };
  }

  // 3) Texto plano genérico.
  if (isLikelyText(header)) return { format: 'txt', label: 'Texto plano', mime: 'text/plain' };

  return null;
}

export const ACCEPT_EXTENSIONS = '.epub,.pdf,.txt,.text,.md,.markdown,.log';

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB duro
export const WARN_FILE_SIZE = 50 * 1024 * 1024; // advertencia a partir de 50 MB (R-01)
