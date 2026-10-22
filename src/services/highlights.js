import { db } from './db.js';
import { uuid } from '../utils/id.js';

/** Resaltados y anotaciones asociados a un fragmento del libro. */
export async function listHighlights(bookId) {
  return db.highlights.where('bookId').equals(bookId).reverse().sortBy('createdAt');
}

export async function addHighlight({
  bookId,
  text,
  note = '',
  color = 'yellow',
  cfi = null,
  page = null,
  regions = null,
  quote = null,
  scrollTop = null
}) {
  const record = {
    id: uuid(),
    bookId,
    text: String(text || '').slice(0, 4000),
    note: String(note || '').trim(),
    color,
    cfi,
    page,
    regions,
    quote,
    scrollTop,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await db.highlights.add(record);
  return record;
}

export async function updateHighlight(id, patch) {
  const changes = { updatedAt: Date.now() };
  if ('note' in patch) changes.note = String(patch.note || '').trim();
  if ('color' in patch) changes.color = patch.color;
  await db.highlights.update(id, changes);
}

export async function removeHighlight(id) {
  await db.highlights.delete(id);
}
