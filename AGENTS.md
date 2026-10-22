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
- Persistence is Dexie (`src/services/db.js`). `books.blob` stores the original file; `books.cover` is an **ArrayBuffer** plus `coverType` (not a Blob). Progress, bookmarks, notes and highlights are keyed by `bookId`. Schema changes require a Dexie version bump/migration; the current schema is **v2** (adds `highlights`).
- Import flow: `useBooks.importFile` → `detectFormat` (`src/utils/magic.js`) → `parseEpub`/`parsePdf`/`parseText` → `createBook`. Limits: 500 MB hard, 50 MB warning. `detectFormat` trusts a known extension and only checks magic bytes when the extension is unknown.
- Reader contract: `EpubReader`, `PdfReader` and `TextReader` expose `next`/`prev`/`goTo`/`search`/`clearSelection` via `forwardRef` + `useImperativeHandle`, report positions through `onLocation({ page|cfi|scrollTop, percent, ... })` and report text selections through `onSelect({ text, cfi|page+regions|quote, ... })`. `ReaderView` owns debounced persistence, keyboard navigation, side tap zones, panels and the highlight composer. Follow this contract for any new format.
- In-book search (`SearchPanel`, Ctrl/⌘+F) calls each reader's `search(query, { signal })`; results carry `page` (PDF), `cfi` (EPUB) or `scrollTop` (TXT/MD) and jump through `jumpToItem`. Matching ignores case and accents via `src/utils/search.js`; PDF page text is cached in `PdfReader`.
- EPUB TOC/locations: correlate by **spine index**, never raw `href` (nav hrefs are relative to the nav document, spine hrefs to the OPF). Helpers: `buildTocList`/`resolveTocHref`/`buildTocIndex` in `src/services/epub.js`.
- PDF scroll mode (`settings.pdfView === 'scroll'`): page offsets come from measured `heights`. Navigate via `goToPage` (updates page state **and** `scrollTop`); `commitPage` alone desyncs scroll and the next `onScroll` overwrites the saved page.
- PDF pages render a canvas plus a pdf.js `TextLayer` (`.pdf-text-layer`, `--scale-factor` must equal the CSS viewport scale). The outline comes from `getPdfOutline()` and is fed to `TocPanel` via `onReady({ toc })`, same shape as EPUB (`label`, `depth`, `page`).
- Reader themes are defined twice: CSS vars `.theme-*` and `.reader-markdown` in `src/index.css` (TXT/MD), plus `THEME_COLORS`/`FONT_STACKS` in `EpubReader.jsx` injected into the EPUB iframe. Update both when changing themes or fonts. Reader settings persist in localStorage under `ready.reader.settings`.
- User covers live in `src/services/cover.js` (resized to 600 px JPEG). `coverCleared: true` prevents the automatic PDF cover backfill in `useBooks`.
- Highlights/annotations live in `src/services/highlights.js` and are rendered per format: EPUB uses `rendition.annotations.highlight` with the CFI range; PDF stores page-relative normalized rects (`regions`) painted under the text layer, so they survive zoom; TXT/MD store text offsets (`quote`) and render with the CSS Custom Highlight API (`::highlight(ready-hl-*)` in `src/index.css`). `SelectionToolbar` creates them, `AnnotationsPanel` edits/deletes them. Any new format must fill `onSelect` and render from the same record shape.
- Backup format (`src/services/backup.js`): zip containing `ready-backup.json` (version 2), `books/<id>.<ext>` and `covers/<id>`; the index includes `progress`, `bookmarks`, `notes` and `highlights`. Any change to book/cover/annotation storage must update both export and import.
- The PDF.js worker is bundled locally via `pdfjs-dist/build/pdf.worker.min.mjs?url`; never point it at a CDN.
- UI strings and code comments are in Spanish; keep new ones in Spanish.
- Prefer the Tailwind component classes in `src/index.css` (`btn-*`, `card`, `icon-btn`, `field`, `chip`) and the custom `ink`/`sepia` palettes over ad-hoc styles.
