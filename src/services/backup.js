import JSZip from 'jszip';
import { db } from './db.js';

/**
 * Backup y Restauración (R-03).
 * Exporta toda la biblioteca (metadatos + binarios) a un .zip y permite reimportarla.
 */

const INDEX_FILE = 'ready-backup.json';

export async function exportBackup() {
  const zip = new JSZip();
  const books = await db.books.toArray();
  const progress = await db.progress.toArray();
  const bookmarks = await db.bookmarks.toArray();
  const notes = await db.notes.toArray();
  const highlights = await db.highlights.toArray();

  for (const book of books) {
    const ext = book.format === 'md' ? 'md' : book.format;
    const name = `${book.id}.${ext}`;
    try {
      zip.file(`books/${name}`, book.blob);
    } catch {
      /* archivo omitido si no se pudo serializar */
    }
    if (book.cover) {
      zip.file(`covers/${book.id}`, book.cover);
    }
  }

  zip.file(
    INDEX_FILE,
    JSON.stringify(
      {
        app: 'ready-app',
        version: 2,
        exportedAt: Date.now(),
        books: books.map(({ blob, ...rest }) => rest),
        progress,
        bookmarks,
        notes,
        highlights
      },
      null,
      2
    )
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return blob;
}

export async function importBackup(file) {
  const zip = await JSZip.loadAsync(file);
  const indexEntry = zip.file(INDEX_FILE);
  if (!indexEntry) throw new Error('El archivo no parece un backup de Ready.');

  const index = JSON.parse(await indexEntry.async('string'));
  if (index.app !== 'ready-app') throw new Error('Backup de una aplicación desconocida.');

  let imported = 0;
  for (const bookMeta of index.books || []) {
    const ext = bookMeta.format === 'md' ? 'md' : bookMeta.format;
    const entry = zip.file(`books/${bookMeta.id}.${ext}`);
    if (!entry) continue;
    const blob = await entry.async('blob');
    const coverEntry = zip.file(`covers/${bookMeta.id}`);
    const cover = coverEntry ? await coverEntry.async('blob') : null;

    const { blob: _omit, ...meta } = bookMeta;
    const record = {
      ...meta,
      cover: cover ? await cover.arrayBuffer() : null
    };
    await db.books.put(record);
    await db.books.update(bookMeta.id, { blob });
    imported++;
  }

  for (const p of index.progress || []) {
    await db.progress.put(p);
  }
  for (const b of index.bookmarks || []) {
    await db.bookmarks.put(b);
  }
  for (const n of index.notes || []) {
    await db.notes.put(n);
  }
  for (const h of index.highlights || []) {
    await db.highlights.put(h);
  }

  return { imported, total: (index.books || []).length };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
