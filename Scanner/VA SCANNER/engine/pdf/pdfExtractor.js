let pdfjsLibPromise;
let workerConfigured = false;

const getPdfjsLib = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist/build/pdf.mjs");
    const pdfjsLib = await pdfjsLibPromise;
    
    // Configure worker path for Node.js environment
    if (!workerConfigured) {
      const workerPath = await import.meta.resolve("pdfjs-dist/build/pdf.worker.mjs");
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
      workerConfigured = true;
    }
  }
  return pdfjsLibPromise;
};

const normalizePdfText = (text) =>
  text
    .replace(/\r/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function extractPdfText(buffer) {
  try {
    const pdfjsLib = await getPdfjsLib();
    
    // Convert Node.js Buffer to Uint8Array for PDF.js
    // PDF.js requires a true Uint8Array, not a Buffer (which is a subclass)
    const uint8Array = Uint8Array.from(buffer);
    
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((x) => x.str).join(" ") + "\n\n";
    }

    return normalizePdfText(text);
  } catch (error) {
    const message = error?.message || "PDF extraction failed";
    const enriched = new Error(message);
    enriched.code = "PDF_EXTRACTION_FAILED";
    enriched.originalError = message;
    throw enriched;
  }
}

export { extractPdfText };
