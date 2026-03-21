import { getDocument } from '../backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'fs';

async function extractPDF(filePath) {
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Preserve spatial layout by grouping items by y-position
    const items = content.items;
    let lineMap = {};
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push({ x: item.transform[4], str: item.str });
    }
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const line = lineMap[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim();
      if (line) fullText += line + '\n';
    }
    fullText += '\n--- PAGE ' + i + ' ---\n\n';
  }
  return fullText;
}

const files = [
  'PDF_Files/DD214 98-03.pdf',
  'PDF_Files/DD214- 09-17.pdf'
];

for (const f of files) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`FILE: ${f}`);
    console.log('='.repeat(80));
    const text = await extractPDF(f);
    console.log(text);
  } catch (e) {
    console.error(`Error processing ${f}:`, e.message);
  }
}
