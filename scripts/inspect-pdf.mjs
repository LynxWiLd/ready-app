import { readFile } from 'node:fs/promises';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const path = process.argv[2];
if (!path) {
  console.error('Uso: node scripts/inspect-pdf.mjs <ruta.pdf>');
  process.exit(1);
}

const buf = await readFile(path);
const data = new Uint8Array(buf);
const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
const { info = {}, metadata } = await doc.getMetadata().catch(() => ({}));
let description = '';
try {
  description = metadata?.get('dc:description') || '';
} catch {
  description = '';
}

console.log(
  JSON.stringify(
    {
      numPages: doc.numPages,
      info: { Title: info.Title, Author: info.Author, Language: info.Language, Producer: info.Producer },
      description,
      firstPageText: (await (async () => {
        const page = await doc.getPage(1);
        const tc = await page.getTextContent();
        return tc.items.map((i) => i.str).join(' ').slice(0, 200);
      })())
    },
    null,
    2
  )
);
