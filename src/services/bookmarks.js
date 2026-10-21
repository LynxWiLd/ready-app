import { db } from './db.js';
import { uuid } from '../utils/id.js';

/** Marcadores: referencia a una posición (CFI / página / ancla). */
export async function listBookmarks(bookId) {
  return db.bookmarks.where('bookId').equals(bookId).reverse().sortBy('createdAt');
}

export async function addBookmark({ bookId, label, cfi = null, page = null, anchor = null, anchorText = '' }) {
  const record = {
    id: uuid(),
    bookId,
    label: label || 'Marcador',
    cfi,
    page,
    anchor,
    anchorText,
    createdAt: Date.now()
  };
  await db.bookmarks.add(record);
  return record;
}

export async function removeBookmark(id) {
  await db.bookmarks.delete(id);
}

/** Notas rápidas asociadas a un fragmento. */
export async function listNotes(bookId) {
  return db.notes.where('bookId').equals(bookId).reverse().sortBy('createdAt');
}

export async function addNote({ bookId, content, cfi = null, page = null, anchor = null, anchorText = '' }) {
  const record = {
    id: uuid(),
    bookId,
    content,
    cfi,
    page,
    anchor,
    anchorText,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await db.notes.add(record);
  return record;
}

export async function updateNote(id, content) {
  await db.notes.update(id, { content, updatedAt: Date.now() });
}

export async function removeNote(id) {
  await db.notes.delete(id);
}
