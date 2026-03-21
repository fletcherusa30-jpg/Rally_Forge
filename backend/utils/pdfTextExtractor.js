import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load pdfjs-dist once at module level to avoid re-initialization overhead on every request.
const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
const workerPath = path.resolve(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

export async function extractPdfTextFromBuffer(buffer) {
  const pdfData = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

  let text = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    text += textContent.items.map((item) => item.str).join(' ') + '\n\n';
  }

  return {
    text,
    numPages: pdf.numPages,
  };
}