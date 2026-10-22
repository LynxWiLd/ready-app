# AGENTS.md

Ready is a **local-first reader PWA** (EPUB, PDF, TXT/Markdown) built with React 18, Vite 5, Tailwind 3 and Dexie/IndexedDB. There is no backend, no network access and no CDN asset loading — keep it that way. All user data lives in the browser.

## Commands

- `npm run dev` — Vite dev server on port 5173.
- `npm run build` — production build in `dist/`, including the PWA service worker. This is the only real verification: there is no test runner, typecheck or CI.
- `npm run lint` — **broken**: `eslint` is not installed and there is no ESLint config. Do not rely on it or silently "fix" it.
- Parser smoke test (Node ESM, from repo root):
  ```
  node scripts/make-test-files.mjs .test-files
  node scripts/test-parsers.mjs .test-files
  ```
  `.test-files/` is gitignored. Only format detection and TXT/Markdown parsing run in Node; EPUB parsing, Markdown sanitization and PDF cover rendering need a browser DOM.
- `node scripts/inspect-pdf.mjs <file.pdf>` — dumps PDF metadata and first-page text in Node.
- To test the service worker/PWA behavior, run `npm run build && npm run preview` (dev mode does not register the SW).

## Architecture notes

- Entry: `src/main.jsx` → `src/App.jsx`. Uses `HashRouter` intentionally so the PWA works from any origin; only routes are `/` (library) and `/read/:bookId` (reader).
- Persistence is Dexie (`src/services/db.js`). `books.blob` stores the original file; `books.cover` is an **ArrayBuffer** plus `coverType` (not a Blob). Progress, bookmarks and notes are keyed by `bookId`. Schema changes require a Dexie version bump/migration.
- Import flow: `useBooks.importFile` → `detectFormat` (`src/utils/magic.js`) → `parseEpub`/`parsePdf`/`parseText` → `createBook`. Limits: 500 MB hard, 50 MB warning. `detectFormat` trusts a known extension and only checks magic bytes when the extension is unknown.
- Reader contract: `EpubReader`, `PdfReader` and `TextReader` expose `next`/`prev`/`goTo` via `forwardRef` + `useImperativeHandle` and report positions through `onLocation({ page|cfi|scrollTop, percent, ... })`. `ReaderView` owns debounced persistence, keyboard navigation and side tap zones. Follow this contract for any new format.
- EPUB TOC/locations: correlate by **spine index**, never raw `href` (nav hrefs are relative to the nav document, spine hrefs to the OPF). Helpers: `buildTocList`/`resolveTocHref`/`buildTocIndex` in `src/services/epub.js`.
- PDF scroll mode (`settings.pdfView === 'scroll'`): page offsets come from measured `heights`. Navigate via `goToPage` (updates page state **and** `scrollTop`); `commitPage` alone desyncs scroll and the next `onScroll` overwrites the saved page.
- Reader themes are defined twice: CSS vars `.theme-*` and `.reader-markdown` in `src/index.css` (TXT/MD), plus `THEME_COLORS`/`FONT_STACKS` in `EpubReader.jsx` injected into the EPUB iframe. Update both when changing themes or fonts. Reader settings persist in localStorage under `ready.reader.settings`.
- User covers live in `src/services/cover.js` (resized to 600 px JPEG). `coverCleared: true` prevents the automatic PDF cover backfill in `useBooks`.
- Backup format (`src/services/backup.js`): zip containing `ready-backup.json`, `books/<id>.<ext>` and `covers/<id>`. Any change to book/cover storage must update both export and import.
- The PDF.js worker is bundled locally via `pdfjs-dist/build/pdf.worker.min.mjs?url`; never point it at a CDN.
- UI strings and code comments are in Spanish; keep new ones in Spanish.
- Prefer the Tailwind component classes in `src/index.css` (`btn-*`, `card`, `icon-btn`, `field`, `chip`) and the custom `ink`/`sepia` palettes over ad-hoc styles.
