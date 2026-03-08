import * as pdfjsLib from 'pdfjs-dist';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure PDF.js worker
const workerPath = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

/**
 * Extract all text from a PDF file with structure preservation
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<Object>} Extracted text with metadata
 */
async function extractPdfText(pdfPath) {
  console.log(`\n[PDF Extract] Processing: ${path.basename(pdfPath)}`);
  
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = new Uint8Array(dataBuffer);
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDocument = await loadingTask.promise;
  
  const numPages = pdfDocument.numPages;
  console.log(`[PDF Extract] Total pages: ${numPages}`);
  
  const pages = [];
  let fullText = '';
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Extract text items with positions for structure detection
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    pages.push({
      pageNumber: pageNum,
      text: pageText,
      itemCount: textContent.items.length
    });
    
    fullText += pageText + '\n\n';
    
    if (pageNum % 10 === 0) {
      console.log(`[PDF Extract] Processed ${pageNum}/${numPages} pages...`);
    }
  }
  
  console.log(`[PDF Extract] Complete! Total characters: ${fullText.length.toLocaleString()}`);
  
  return {
    fileName: path.basename(pdfPath),
    totalPages: numPages,
    pages,
    fullText,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Main extraction function
 */
async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           38 CFR PDF TEXT EXTRACTION                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    const pdfFiles = [
      'c:\\Dev\\Rally Forge\\38 CFR Part 3 (up to date as of 2-12-2026).pdf',
      'c:\\Dev\\Rally Forge\\38 CFR Part 4 (up to date as of 2-12-2026).pdf'
    ];
    
    // Create output directory
    const outputDir = path.join(__dirname, 'knowledge', '_raw_extraction');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`[Created] ${outputDir}`);
    }
    
    // Extract each PDF
    for (const pdfPath of pdfFiles) {
      const result = await extractPdfText(pdfPath);
      
      // Determine part number
      const partNum = pdfPath.includes('Part 3') ? 'part3' : 'part4';
      
      // Save full extraction
      const outputPath = path.join(outputDir, `${partNum}_raw.json`);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`[Saved] ${outputPath}`);
      
      // Save text-only version for easier processing
      const textPath = path.join(outputDir, `${partNum}_text.txt`);
      fs.writeFileSync(textPath, result.fullText);
      console.log(`[Saved] ${textPath}`);
      
      console.log(`\n[Stats] ${partNum.toUpperCase()}`);
      console.log(`  Pages: ${result.totalPages}`);
      console.log(`  Characters: ${result.fullText.length.toLocaleString()}`);
      console.log(`  Words: ${result.fullText.split(/\s+/).length.toLocaleString()}\n`);
    }
    
    console.log('✅ PDF extraction complete!');
    console.log('   Next: Run CFR parser to structure the regulatory text\n');
    
  } catch (error) {
    console.error('❌ [Error]', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

