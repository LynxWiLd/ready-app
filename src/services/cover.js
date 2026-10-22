import { updateBook } from './db.js';

/**
 * Portadas de usuario (RF-06): permite reemplazar o quitar la portada
 * de un libro desde la biblioteca. Las imágenes se reducen y convierten
 * a JPEG para no hinchar IndexedDB.
 */

const MAX_WIDTH = 600;
const JPEG_QUALITY = 0.85;

/** Convierte un archivo de imagen en un buffer listo para la BD (max 600px). */
export async function fileToCoverBuffer(file, maxWidth = MAX_WIDTH) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen (JPG, PNG, WebP…).');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('No se pudo leer la imagen; prueba con JPG o PNG.');
  }

  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('No se pudo procesar la imagen.');
    return { data: await blob.arrayBuffer(), type: 'image/jpeg' };
  } finally {
    bitmap.close?.();
  }
}

/** Guarda una imagen elegida por el usuario como portada del libro. */
export async function setBookCover(bookId, file) {
  const { data, type } = await fileToCoverBuffer(file);
  await updateBook(bookId, { cover: data, coverType: type });
}

/**
 * Quita la portada del libro. Marca `coverCleared` para que el backfill
 * automático de portadas PDF no la vuelva a generar en futuras sesiones.
 */
export async function clearBookCover(bookId) {
  await updateBook(bookId, { cover: null, coverType: null, coverCleared: true });
}
