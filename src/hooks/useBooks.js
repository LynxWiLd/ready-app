import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllBooks, createBook, deleteBook, getBook, updateBook } from '../services/db.js';
import { detectFormat, WARN_FILE_SIZE, MAX_FILE_SIZE } from '../utils/magic.js';
import { parseEpub } from '../services/epub.js';
import { parsePdf, openPdf, renderPdfCover } from '../services/pdf.js';
import { parseText } from '../services/text.js';

/**
 * Gestión de la biblioteca: carga, importación y borrado.
 * Expone el estado de importación para mostrar progreso en UI.
 */
export function useBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(null); // {name, percent, error}

  const refresh = useCallback(async () => {
    try {
      const all = await getAllBooks();
      setBooks(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Portadas de preview para PDFs importados antes de existir el render
  // de portada (o cuya portada automática falló). Se salta los libros cuya
  // portada quitó el usuario (`coverCleared`).
  const backfillStarted = useRef(false);
  useEffect(() => {
    if (backfillStarted.current) return;
    backfillStarted.current = true;
    (async () => {
      try {
        const all = await getAllBooks();
        const pending = all.filter((b) => b.format === 'pdf' && !b.cover && !b.coverCleared && b.blob);
        let changed = 0;
        for (const book of pending) {
          let handle = null;
          try {
            handle = await openPdf(book.blob);
            const coverBlob = await renderPdfCover(handle.doc);
            if (coverBlob) {
              await updateBook(book.id, {
                cover: await coverBlob.arrayBuffer(),
                coverType: coverBlob.type
              });
              changed++;
            }
          } catch {
            /* libro ilegible o render no disponible */
          } finally {
            try {
              handle?.destroy();
            } catch {
              /* noop */
            }
          }
        }
        if (changed) await refresh();
      } catch {
        /* backfill best-effort */
      }
    })();
  }, [refresh]);

  const importFile = useCallback(
    async (file) => {
      let hadError = false;
      setImporting({ name: file.name, percent: 10, error: null });
      try {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`El archivo supera el límite de ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.`);
        }

        const formatInfo = await detectFormat(file);
        if (!formatInfo) {
          throw new Error('Formato no soportado. Usa EPUB, PDF, TXT o Markdown.');
        }

        setImporting({ name: file.name, percent: 40, error: null, warning: file.size > WARN_FILE_SIZE });

        let meta;
        if (formatInfo.format === 'epub') {
          meta = await parseEpub(file);
        } else if (formatInfo.format === 'pdf') {
          meta = await parsePdf(file);
        } else {
          const text = await parseText(file);
          meta = {
            title: file.name.replace(/\.[^.]+$/, ''),
            author: 'Texto local',
            description: '',
            spineCount: null,
            wordCount: text.wordCount,
            coverBlob: null
          };
        }

        setImporting({ name: file.name, percent: 85, error: null, warning: file.size > WARN_FILE_SIZE });

        const record = await createBook({
          blob: file,
          format: formatInfo.format,
          meta: { ...meta, coverBlob: meta.coverBlob },
          cover: meta.coverBlob ? { blob: meta.coverBlob, type: meta.coverBlob.type } : null
        });

        await refresh();
        setImporting({ name: file.name, percent: 100, error: null });
        return record;
      } catch (err) {
        hadError = true;
        const message =
          err?.name === 'EPUBError' || String(err?.message || '').includes('zip')
            ? 'No se pudo leer el EPUB; es posible que esté dañado.'
            : err?.name === 'PasswordException'
              ? 'El PDF está protegido con contraseña.'
              : err?.message || 'No se pudo importar el archivo.';
        setImporting({ name: file.name, percent: 0, error: message });
        throw err;
      } finally {
        setTimeout(() => setImporting(null), hadError ? 5000 : 900);
      }
    },
    [refresh]
  );

  const removeBook = useCallback(
    async (id) => {
      await deleteBook(id);
      await refresh();
    },
    [refresh]
  );

  const openBook = useCallback(async (id) => {
    return getBook(id);
  }, []);

  return { books, loading, importing, refresh, importFile, removeBook, openBook };
}
