import JSZip from 'jszip';
import { writeFile, mkdir } from 'node:fs/promises';

const outDir = process.argv[2] || '.test-files';
await mkdir(outDir, { recursive: true });

// ---------- EPUB ----------
const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip');
zip.file(
  'META-INF/container.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
);
zip.file(
  'OEBPS/content.opf',
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>El Principito de Prueba</dc:title>
    <dc:creator>Antoine de Test</dc:creator>
    <dc:language>es</dc:language>
    <dc:publisher>Ready Labs</dc:publisher>
    <dc:description>EPUB generado para probar el lector.</dc:description>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`
);
const ch1 = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo 1</title></head>
<body><h1>Capítulo 1</h1>
<p>Esta es la primera página del libro de prueba. Contiene varias frases para poder paginar con comodidad y verificar el desplazamiento.</p>
<p>La zorra y el principito se encontraron en el desierto. Era un lugar amplio, silencioso y lleno de estrellas que parpadeaban con timidez.</p>
<p>Las hojas de estilo de este documento usan colores fuertes a propósito: la palabra clave es <b>prueba</b>.</p>
</body></html>`;
const ch2 = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo 2</title></head>
<body><h1>Capítulo 2</h1>
<p>Segundo capítulo. El lector debe permitir avanzar y retroceder con las flechas del teclado y con las zonas de clic laterales.</p>
</body></html>`;
zip.file('OEBPS/ch1.xhtml', ch1);
zip.file('OEBPS/ch2.xhtml', ch2);
zip.file(
  'OEBPS/nav.xhtml',
  `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Nav</title></head>
<body><nav epub:type="toc"><ol><li><a href="ch1.xhtml">Capítulo 1</a></li><li><a href="ch2.xhtml">Capítulo 2</a></li></ol></nav></body></html>`
);
const epubBuf = await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
await writeFile(`${outDir}/sample.epub`, epubBuf);

// ---------- PDF (generado con xref correcto) ----------
const objects = [
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
  '<</Length 84>>\nstream\nBT /F1 22 Tf 72 720 Td (Hola desde Ready PDF) Tj ET\nBT /F1 12 Tf 72 690 Td (Pagina de prueba 1) Tj ET\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'
];

let pdf = '%PDF-1.4\n';
const offsets = [0];
for (let i = 0; i < objects.length; i++) {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xrefStart = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objects.length; i++) {
  pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
await writeFile(`${outDir}/sample.pdf`, pdf, 'latin1');

// ---------- TXT ----------
await writeFile(
  `${outDir}/sample.txt`,
  `Texto plano de prueba\n\nEste archivo sirve para verificar el lector de texto y el guardado de progreso por desplazamiento.\n\nPárrafo tres.\nPárrafo cuatro.\nPárrafo cinco con más contenido para generar scroll.\n`,
  'utf8'
);

// ---------- Markdown ----------
await writeFile(
  `${outDir}/sample.md`,
  `# Documento Markdown de prueba\n\n## Sección uno\n\nEste es un **párrafo** con *énfasis*, \`código\` y un [enlace](https://example.com).\n\n- Uno\n- Dos\n- Tres\n\n> Una cita.\n\n## Sección dos\n\n\`\`\`js\nconst hola = 'mundo';\n\`\`\`\n`,
  'utf8'
);

console.log('Archivos generados en', outDir);
