/**
 * PDF Text Extraction Utility
 * Uses PDF.js library for robust PDF text extraction with document type detection
 */

import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure PDF.js worker
const pdfjsVersion = pdfjsLib.version;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`;

/**
 * Extract text from PDF file using PDF.js
 * @param {File} file - PDF file object
 * @returns {Promise<string>} Extracted text content
 */
export async function extractPDFText(file, options = {}) {
  console.log('=== extractPDFText (PDF.js) called ===');
  console.log('File name:', file.name);
  console.log('File size:', file.size);
  console.log('File type:', file.type);

  const {
    enableOcr = true,
    ocrLanguage = 'eng',
    ocrScale = 1.5,
    ocrTimeoutMs = 120000,
    onOcrProgress = null
  } = options;
  
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    console.log('ArrayBuffer loaded. Size:', arrayBuffer.byteLength);
    
    // Load PDF document using PDF.js
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded. Pages: ${pdf.numPages}`);
    
    // Extract text from all pages
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items with proper line breaks
      let lastY = null;
      const pageText = textContent.items.map((item, i) => {
        const currentY = item.transform[5]; // Y coordinate
        const nextItem = textContent.items[i + 1];
        const nextY = nextItem ? nextItem.transform[5] : null;
        
        // Add newline if Y coordinate changed (new line)
        if (lastY !== null && Math.abs(currentY - lastY) > 2) {
          lastY = currentY;
          return '\n' + item.str;
        }
        
        lastY = currentY;
        
        // Add space before item unless it's punctuation
        if (i > 0 && !/^[.,;:!?)\]}>]/.test(item.str)) {
          return ' ' + item.str;
        }
        
        return item.str;
      }).join('');
      
      fullText += pageText + '\n\n--- PAGE ' + pageNum + ' END ---\n\n';
      console.log(`Page ${pageNum} extracted: ${pageText.length} chars`);
    }
    
    // Clean up extracted text - preserve line breaks
    fullText = fullText
      .replace(/[ \t]+/g, ' ')       // Normalize spaces/tabs only (preserve newlines)
      .replace(/\n{3,}/g, '\n\n')    // Limit consecutive newlines to max 2
      .trim();
    
    console.log('Total extracted text length:', fullText.length);
    console.log('First 500 chars:', fullText.substring(0, 500));
    
    // Check text quality for garbled/binary content
    const qualityCheck = detectGarbledText(fullText);
    console.log('Text quality score:', qualityCheck.score);
    console.log('Garbled percentage:', qualityCheck.garbledPercentage);

    if (qualityCheck.isGarbled || fullText.length < 50) {
      console.warn('PDF text quality is poor or missing. Attempting OCR fallback.');

      if (enableOcr) {
        const ocrText = await extractTextWithOcr(pdf, {
          language: ocrLanguage,
          scale: ocrScale,
          timeoutMs: ocrTimeoutMs,
          onProgress: onOcrProgress
        });

        const ocrQuality = detectGarbledText(ocrText);
        console.log('OCR text quality score:', ocrQuality.score);
        console.log('OCR garbled percentage:', ocrQuality.garbledPercentage);

        if (ocrText && ocrText.length >= 50 && !ocrQuality.isGarbled) {
          return ocrText;
        }

        const error = new Error('PDF_SCANNED_IMAGE_DETECTED');
        error.details = ocrQuality.reason || 'OCR produced insufficient text';
        throw error;
      }

      const error = new Error('PDF_SCANNED_IMAGE_DETECTED');
      error.details = qualityCheck.reason || 'PDF text layer missing';
      throw error;
    }
    
    // Detect document type and validate
    const docType = detectDocumentType(fullText);
    console.log('Document type detected:', docType.type);
    console.log('Is rating decision:', docType.isRatingDecision);
    
    // Return both text and metadata
    return fullText;
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    
    if (error.code === 'OCR_TIMEOUT' || error.message === 'OCR_TIMEOUT') {
      const userMessage = 'OCR timed out while processing this PDF. Please try again or use a smaller file.';
      const enhancedError = new Error(userMessage);
      enhancedError.code = 'OCR_TIMEOUT';
      throw enhancedError;
    }

    if (error.message === 'PDF_SCANNED_IMAGE_DETECTED') {
      const userMessage = 'This PDF appears to be a scanned image with no text layer. Please use OCR software or manually enter the text.';
      const enhancedError = new Error(userMessage);
      enhancedError.code = 'PDF_SCANNED_IMAGE_DETECTED';
      enhancedError.details = error.details;
      throw enhancedError;
    }
    
    if (error.message === 'PDF_NEEDS_MANUAL_EXTRACTION') {
      throw error;
    }
    
    // DO NOT use fallback extraction - it produces garbled text
    console.error('PDF.js extraction failed - manual extraction required');
    const userMessage = 'Unable to extract text from this PDF automatically. Please manually copy and paste the text.';
    const enhancedError = new Error(userMessage);
    enhancedError.code = 'PDF_EXTRACTION_FAILED';
    enhancedError.originalError = error.message;
    throw enhancedError;
  }
}

/**
 * Read file as ArrayBuffer (Promise wrapper)
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * OCR fallback for scanned PDFs (no text layer)
 * @param {Object} pdf - PDF.js document
 * @param {Object} options - OCR options
 * @returns {Promise<string>} OCR extracted text
 */
async function extractTextWithOcr(pdf, options) {
  const { language, scale, timeoutMs, onProgress } = options;
  let ocrText = '';
  const startTime = Date.now();
  const totalPages = pdf.numPages;

  const throwIfTimedOut = () => {
    if (!timeoutMs) return;
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      const error = new Error('OCR_TIMEOUT');
      error.code = 'OCR_TIMEOUT';
      throw error;
    }
  };

  const withTimeout = async (promise, timeoutRemaining) => {
    if (!timeoutRemaining || timeoutRemaining <= 0) {
      const error = new Error('OCR_TIMEOUT');
      error.code = 'OCR_TIMEOUT';
      throw error;
    }

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error('OCR_TIMEOUT');
        error.code = 'OCR_TIMEOUT';
        reject(error);
      }, timeoutRemaining);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    throwIfTimedOut();

    if (typeof onProgress === 'function') {
      onProgress({
        page: pageNum,
        totalPages,
        progress: 0,
        status: 'starting'
      });
    }

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');

    await page.render({ canvasContext: context, viewport }).promise;

    const timeoutRemaining = timeoutMs ? timeoutMs - (Date.now() - startTime) : null;
    const result = await withTimeout(Tesseract.recognize(canvas, language, {
      logger: (message) => {
        if (message.status === 'recognizing text') {
          const progress = Math.round((message.progress || 0) * 100);
          console.log(`[OCR][Page ${pageNum}] ${progress}%`);
        }

        if (typeof onProgress === 'function') {
          onProgress({
            page: pageNum,
            totalPages,
            progress: message.progress || 0,
            status: message.status || 'recognizing text'
          });
        }
      }
    }), timeoutRemaining);

    const pageText = result?.data?.text || '';
    ocrText += pageText + '\n\n--- PAGE ' + pageNum + ' END ---\n\n';

    canvas.width = 0;
    canvas.height = 0;
  }

  return ocrText
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Detect if extracted text contains too many non-printable/garbled characters
 * @param {string} text - Extracted text to check
 * @returns {Object} Quality check results
 */
function detectGarbledText(text) {
  if (!text || text.length === 0) {
    return { 
      isGarbled: true, 
      score: 0,
      reason: 'No text extracted - likely scanned image PDF'
    };
  }

  const totalLength = text.length;
  let nonPrintableCount = 0;
  let controlCharCount = 0;
  let highByteCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    
    // Count control characters (except tab, newline, carriage return)
    if ((code < 9 || (code > 13 && code < 32)) && code !== 127) {
      controlCharCount++;
    }
    
    // Count non-printable ASCII
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintableCount++;
    }
    
    // Count high bytes that might indicate binary data
    if (code > 127 && code < 160) {
      highByteCount++;
    }
  }

  const totalBadChars = nonPrintableCount + controlCharCount + highByteCount;
  const garbledPercentage = totalBadChars / totalLength;
  
  // Score: 0-1, where 1 is perfect and 0 is completely garbled
  const qualityScore = 1 - garbledPercentage;
  
  const isGarbled = garbledPercentage > 0.15; // >15% garbled = bad

  return {
    isGarbled,
    score: qualityScore,
    garbledPercentage,
    totalBadChars,
    totalLength,
    reason: isGarbled 
      ? `Text contains ${Math.round(garbledPercentage * 100)}% non-printable characters - likely scanned image or corrupted PDF`
      : null
  };
}

/**
 * Detect document type from extracted text
 * @param {string} text - Extracted PDF text
 * @returns {Object} Document type information
 */
export function detectDocumentType(text) {
  const lowered = text.toLowerCase();
  
  // Check for VA Form 10182 (Notice of Disagreement)
  const isNOD = /notice\s+of\s+disagreement/i.test(text) || 
                /va\s+form\s+10182/i.test(text) ||
                /appeal\s+process\s+election/i.test(text);
  
  if (isNOD) {
    return {
      type: 'VA_FORM_10182_NOTICE_OF_DISAGREEMENT',
      isRatingDecision: false,
      warning: 'This is an appeal form, not a rating decision letter. Please upload your VA Rating Decision Letter instead.'
    };
  }
  
  // Check for 38 CFR authority documents
  const isCFR = /title\s+38.*code\s+of\s+federal\s+regulations/i.test(text) &&
                /part\s+\d+/i.test(text) &&
                text.match(/§\s*\d+\.\d+/g)?.length > 5;
  
  if (isCFR) {
    return {
      type: '38_CFR_AUTHORITY_DOCUMENT',
      isRatingDecision: false,
      warning: 'This is a CFR regulations document, not your personal rating decision. Please upload your VA Rating Decision Letter.'
    };
  }
  
  // Check for rating decision indicators
  const ratingCues = [
    /rating\s+decision/i.test(text),
    /service\s+connection.*?(?:is\s+)?(?:granted|denied)/i.test(text),
    /evaluation\s+of\s+\d{1,3}\s*(?:%|percent)/i.test(text),
    /combined\s+rating.*?\d{1,3}\s*%/i.test(text),
    /effective\s+date/i.test(text) && /decision\s+date/i.test(text)
  ].filter(Boolean).length;
  
  if (ratingCues >= 2) {
    return {
      type: 'VA_RATING_DECISION',
      isRatingDecision: true,
      warning: null
    };
  }
  
  // Check for decision letter (notification of rating)
  const isDecisionLetter = /we\s+(?:have\s+)?made\s+a\s+decision/i.test(text) &&
                           /combined\s+rating/i.test(text);
  
  if (isDecisionLetter) {
    return {
      type: 'VA_DECISION_LETTER',
      isRatingDecision: true,
      warning: null
    };
  }
  
  // Check for DD214
  const isDD214 = /certificate\s+of\s+release/i.test(text) ||
                  /dd\s*form\s*214/i.test(text) ||
                  /armed\s+forces.*?united\s+states/i.test(text);
  
  if (isDD214) {
    return {
      type: 'DD214_DISCHARGE_PAPERS',
      isRatingDecision: false,
      warning: 'This is your DD214 (discharge papers), not a rating decision. Please upload your VA Rating Decision Letter instead.'
    };
  }
  
  // Unknown document type
  return {
    type: 'UNKNOWN',
    isRatingDecision: false,
    warning: 'Unable to identify document type. Please ensure you are uploading a VA Rating Decision Letter.'
  };
}

/**
 * Extract text from PDF ArrayBuffer using fallback method (basic extraction)
 * @param {ArrayBuffer} arrayBuffer - PDF file data
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromArrayBuffer(arrayBuffer) {
  console.log('=== extractTextFromArrayBuffer called ===');
  const uint8Array = new Uint8Array(arrayBuffer);
  let extractedText = '';
  
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const pdfString = decoder.decode(uint8Array);
  console.log('Decoded PDF string length:', pdfString.length);
  
  // Method 1: Extract text between BT (Begin Text) and ET (End Text) markers
  const textMatches = pdfString.match(/BT(.*?)ET/gs);
  console.log('Method 1 (BT/ET markers) - Matches found:', textMatches?.length || 0);
  
  if (textMatches && textMatches.length > 0) {
    textMatches.forEach(match => {
      const cleanText = match
        .replace(/BT|ET|Tj|TJ|Td|TD|T\*|Tm/g, ' ')
        .replace(/\\[0-9]+/g, '')
        .replace(/[()\[\]<>]/g, ' ')
        .replace(/\/F[0-9]+/g, '')
        .replace(/[0-9]+\s+Tf/g, '')
        .replace(/[0-9]+\s+[0-9]+\s+[0-9]+\s+(RG|rg)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleanText && cleanText.length > 2) {
        extractedText += cleanText + ' ';
      }
    });
    console.log('Method 1 - Extracted text length:', extractedText.length);
  }
  
  // Method 2: Look for text in parentheses (common PDF text format)
  if (!extractedText || extractedText.length < 100) {
    console.log('Trying Method 2 (parentheses)...');
    const parenthesesMatches = pdfString.match(/\(([^()]+)\)/g);
    console.log('Method 2 - Matches found:', parenthesesMatches?.length || 0);
    if (parenthesesMatches) {
      parenthesesMatches.forEach(match => {
        const cleanText = match
          .replace(/[()]/g, '')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .trim();
        if (cleanText) {
          extractedText += cleanText + ' ';
        }
      });
      console.log('Method 2 - Total extracted text length:', extractedText.length);
      console.log('Method 2 - Sample:', extractedText.substring(0, 200));
    }
  }
  
  // Method 3: Look for string objects <...>
  if (!extractedText || extractedText.length < 100) {
    console.log('Trying Method 3 (hex strings)...');
    const hexMatches = pdfString.match(/<([0-9A-Fa-f\s]+)>/g);
    console.log('Method 3 - Matches found:', hexMatches?.length || 0);
    if (hexMatches) {
      hexMatches.forEach(match => {
        try {
          const hex = match.replace(/[<>]/g, '').replace(/\s/g, '');
          let text = '';
          for (let i = 0; i < hex.length; i += 2) {
            const charCode = parseInt(hex.substr(i, 2), 16);
            if (charCode >= 32 && charCode <= 126) {
              text += String.fromCharCode(charCode);
            }
          }
          if (text.trim()) {
            extractedText += text + ' ';
          }
        } catch (e) {
          // Skip invalid hex strings
        }
      });
      console.log('Method 3 - Total extracted text length:', extractedText.length);
    }
  }
  
  // Clean up the extracted text - preserve structure
  extractedText = extractedText
    .replace(/[ \t]+/g, ' ')      // Normalize spaces/tabs only
    .replace(/\\n/g, '\n')        // Convert escaped newlines
    .replace(/\\r/g, '')          // Remove carriage returns
    .replace(/\n{3,}/g, '\n\n')   // Limit consecutive newlines
    .trim();
  
  console.log('Final extracted text length:', extractedText.length);
  console.log('Final text sample (first 500 chars):', extractedText.substring(0, 500));
  
  return extractedText;
}

/**
 * Check if a file is a PDF
 * @param {File} file - File object
 * @returns {boolean} True if PDF
 */
export function isPDF(file) {
  return file.type === 'application/pdf' || 
         file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Get user-friendly instructions for manual PDF text extraction
 * @param {string} filename - PDF filename
 * @returns {string} Instructions
 */
export function getPDFManualExtractionInstructions(filename) {
  return `
To extract text from ${filename}:

1. Open the PDF file in your PDF viewer (Adobe Reader, browser, etc.)
2. Select all text (Ctrl+A on Windows, Cmd+A on Mac)
3. Copy the selected text (Ctrl+C on Windows, Cmd+C on Mac)
4. Switch to "Manually Enter Document Text" mode above
5. Paste the text into the text area (Ctrl+V on Windows, Cmd+V on Mac)
6. Click "Process Narrative" button

This method works best for ensuring all text is captured correctly.
  `.trim();
}

