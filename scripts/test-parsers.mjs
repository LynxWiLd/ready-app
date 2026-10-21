import { readFile } from 'node:fs/promises';
import { parseText } from '../src/services/text.js';
import { renderMarkdown } from '../src/services/text.js';
import { detectFormat } from '../src/utils/magic.js';

const dir = process.argv[2];
const files = ['sample.epub', 'sample.txt', 'sample.md'];

for (const name of files) {
  const buf = await readFile(`${dir}/${name}`);
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  blob.name = name;
  const fmt = await detectFormat(blob);
  console.log(`\n=== ${name} → formato: ${fmt ? fmt.format : 'DESCONOCIDO'} ===`);
  try {
    if (fmt?.format === 'epub') {
      console.log('(parseo EPUB se valida en el navegador: epubjs requiere APIs de DOM)');
    } else {
      const parsed = await parseText(blob);
      console.log('Texto: wordCount=', parsed.wordCount, 'isMarkdown=', parsed.isMarkdown);
      if (parsed.isMarkdown) {
        try {
          const html = renderMarkdown(parsed.text);
          console.log('HTML render:', html.slice(0, 120).replace(/\n/g, ' '));
        } catch (e) {
          console.log('Render Markdown no disponible en Node (DOMPurify requiere DOM):', e?.message);
        }
      }
    }
  } catch (e) {
    console.log('ERROR parser:', e?.message);
  }
}

// Detección de un archivo no soportado
const bad = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])]);
bad.name = 'misterio.xyz';
console.log('\nArchivo desconocido →', await detectFormat(bad));
