import { discoverLocalCfrPdfSources, writeStructuredCfrIndex } from '../../backend/services/cfrPdfParserService.js';
import { readDbqIndex } from '../../backend/services/dbqIndexService.js';
import { writeDbqCfrLinks } from '../../backend/services/cfrIndexService.js';

async function main() {
  const sourcePdfs = await discoverLocalCfrPdfSources();
  if (!sourcePdfs.length) {
    throw new Error('No local CFR PDFs found. Expected Part 3/Part 4 or Title 38 PDF in workspace root.');
  }

  const result = await writeStructuredCfrIndex({ sourcePdfs });
  console.log('CFR index written:', result.outputPath);
  console.log('Sources:', result.metadata.sources.length);
  console.log('Sections indexed:', result.metadata.sectionsIndexed);

  try {
    const dbq = await readDbqIndex();
    const dbqLinks = await writeDbqCfrLinks(dbq.rows || []);
    console.log('DBQ CFR links written:', dbqLinks.outputPath);
    console.log('DBQ links count:', dbqLinks.linksCount);
  } catch (error) {
    console.warn('DBQ CFR links skipped:', error.message);
  }
}

main().catch((error) => {
  console.error('[build-cfr-index] failed:', error.message);
  process.exit(1);
});
