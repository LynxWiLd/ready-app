import Dexie from 'dexie';
import { uuid } from '../utils/id.js';

/**
 * Base de datos Local-First (IndexedDB vía Dexie).
 * RNF-01: todo se almacena en el dispositivo, sin red.
 */
export const db = new Dexie('ready-app');

db.version(1).stores({
  books: 'id, format, title, author, addedAt, lastOpenedAt, size',
  progress: 'bookId, updatedAt',
  bookmarks: 'id, bookId, createdAt',
  notes: 'id, bookId, createdAt',
  settings: 'key'
});

export const FORMATS = ['epub', 'pdf', 'txt', 'md'];
export const FORMAT_LABELS = {
  epub: 'EPUB',
  pdf: 'PDF',
  txt: 'TXT',
  md: 'Markdown'
};

/** Crea una portada a partir de un Blob de imagen. */
export async function blobToCover(blob) {
  if (!blob) return null;
  return { blob, type: blob.type || 'image/jpeg' };
}

/** Normaliza y guarda un libro. */
export async function createBook({ blob, meta, format, cover, extra = {} }) {
  const id = uuid();
  const now = Date.now();
  const record = {
    id,
    title: meta.title || 'Sin título',
    author: meta.author || meta.creator || 'Autor desconocido',
    format,
    fileType: blob.type || 'application/octet-stream',
    size: blob.size,
    blob,
    addedAt: now,
    lastOpenedAt: 0,
    progress: 0,
    cover: cover ? await coverBlobToData(cover) : null,
    coverType: cover ? cover.type : null,
    metadata: {
      language: meta.language || '',
      publisher: meta.publisher || '',
      description: meta.description || '',
      isbn: meta.isbn || '',
      spineCount: meta.spineCount ?? null,
      wordCount: meta.wordCount ?? null
    },
    ...extra
  };
  await db.books.put(record);
  await db.progress.put({ bookId: id, updatedAt: now, cfi: null, page: null, scrollTop: 0, percent: 0 });
  return record;
}

async function coverBlobToData(cover) {
  const buf = await cover.blob.arrayBuffer();
  return buf;
}

export async function updateBook(id, patch) {
  await db.books.update(id, patch);
}

export async function deleteBook(id) {
  await db.transaction('rw', [db.books, db.progress, db.bookmarks, db.notes], async () => {
    await db.books.delete(id);
    await db.progress.delete(id);
    await db.bookmarks.where('bookId').equals(id).delete();
    await db.notes.where('bookId').equals(id).delete();
  });
}

export async function getBook(id) {
  return db.books.get(id);
}

export async function getAllBooks() {
  return db.books.orderBy('addedAt').reverse().toArray();
}

export async function saveProgress({ bookId, cfi = null, page = null, scrollTop = null, percent = 0 }) {
  await db.progress.put({ bookId, cfi, page, scrollTop, percent, updatedAt: Date.now() });
  await db.books.update(bookId, { progress: percent, lastOpenedAt: Date.now() });
}

export async function getProgress(bookId) {
  return db.progress.get(bookId);
}

export async function touchOpened(bookId) {
  await db.books.update(bookId, { lastOpenedAt: Date.now() });
}
