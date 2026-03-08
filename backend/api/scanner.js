import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { scanVaDecision, looksLikeRatingDecisionNarrative } from '../va_scanner/engine/vaSuperScanner.js';
import { getSMCRate, getAncillaryRate } from '../va_scanner/engine/rateLoader.js';
import { extractDependents } from '../va_scanner/frontend/utils/extractDependents.js';
import { getDisabilityAmount, getDependentAmount, getRatesForYear } from '../va_scanner/engine/rateEscalator.js';
import { computeDependentCompensation } from '../services/dependentCompensationEngine.js';
import { scannerRateLimiter } from '../middleware/hardening.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SMC_RANK_ORDER = ['T', 'S', 'R2', 'R1', 'O', 'N½', 'N', 'M½', 'M', 'L½', 'L', 'K'];

function extractSmcCodesFromText(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  const codes = new Set();

  const explicitMatches = text.matchAll(/\bSMC[-\s]?(R1|R2|L½|M½|N½|[KLMNOST])\b/gi);
  for (const match of explicitMatches) {
    codes.add(match[1].toUpperCase());
  }

  const levelListMatches = text.matchAll(/(?:^|[,;\s])(R1|R2|L½|M½|N½|[KLMNOST])\s*[-:]/gi);
  for (const match of levelListMatches) {
    codes.add(match[1].toUpperCase());
  }

  return Array.from(codes);
}

function textSuggestsAidAndAttendance(value) {
  const text = String(value || '').toLowerCase();
  return text.includes('aid and attendance') || text.includes('a&a');
}

function textSuggestsHousebound(value) {
  const text = String(value || '').toLowerCase();
  return text.includes('housebound');
}

function getHighestSmcCode(scanData = {}) {
  const levelCandidates = new Set();

  // Use scanner detectedLevels directly (extractSMC already enforces explicit granted-only SMC)
  const detectedLevels = Array.isArray(scanData?.smc?.detectedLevels) ? scanData.smc.detectedLevels : [];
  detectedLevels.forEach((item) => {
    const level = String(item?.level || '').toUpperCase();
    if (level) {
      levelCandidates.add(level);
    }
  });

  // Fallback parse from explicit string entries if detectedLevels is empty
  const explicitSmc = Array.isArray(scanData?.smc?.explicit) ? scanData.smc.explicit : [];
  explicitSmc.forEach((entry) => {
    const parsedCodes = extractSmcCodesFromText(entry);
    parsedCodes.forEach((code) => levelCandidates.add(code));
  });

  for (const code of SMC_RANK_ORDER) {
    if (levelCandidates.has(code)) {
      return code;
    }
  }

  return null;
}

function getAncillaryFlags(scanData = {}) {
  // STRICT: Only include ancillary benefits that are EXPLICITLY GRANTED in the document
  // Not inferred, not mentioned in lists/legends, not from glossaries
  const ancillaryBenefits = Array.isArray(scanData?.ancillaryBenefits) ? scanData.ancillaryBenefits : [];

  let aidAndAttendance = false;
  let housebound = false;

  ancillaryBenefits.forEach((benefit) => {
    const status = String(benefit?.status || '').toLowerCase();
    const name = String(benefit?.benefit || benefit?.shortName || '').toLowerCase();
    
    // STRICT: Must be explicitly granted (not inferred, not merely eligible)
    const isExplicitlyGranted = status === 'granted';

    if (!isExplicitlyGranted) {
      return;
    }

    if (name.includes('aid and attendance')) {
      aidAndAttendance = true;
    }
    if (name.includes('housebound')) {
      housebound = true;
    }
  });

  // IMPORTANT: Do NOT scan SMC list or fallback to "mentions" of A&A
  // Only explicit grant detection above counts
  // DEA (Dependent's Educational Assistance) is NOT A&A and should NOT trigger it

  return { aidAndAttendance, housebound };
}

if (typeof Promise.withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    value: function withResolvers() {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    },
    writable: true,
    configurable: true
  });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
    } else {
      cb(null, true);
    }
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Scanner API is working',
    scannerVersion: '2.0.0-authoritative',
    timestamp: new Date().toISOString()
  });
});

// PDF upload and scan endpoint
router.post('/scan-pdf', scannerRateLimiter, upload.single('file'), async (req, res) => {
  console.log('[Scanner] POST /scan-pdf received');
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No PDF file provided'
    });
  }

  console.log(`[Scanner] Processing PDF: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
  
  try {
    // Import pdfjs-dist dynamically
    const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
    const workerPath = path.resolve(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    
    // Extract text from PDF
    const pdfData = new Uint8Array(req.file.buffer);
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    
    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      extractedText += pageText + '\n\n';
    }
    
    console.log(`[Scanner] Extracted ${extractedText.length} characters from ${pdf.numPages} pages`);

    if (!looksLikeRatingDecisionNarrative(extractedText)) {
      return res.status(422).json({
        success: false,
        error: 'This document does not look like a VA Rating Decision narrative.'
      });
    }

    // DEBUG: Check for dependent table headers in extracted text
    const hasDepTableHeader = /type\s+of\s+dependent\s+name\s+effective\s+date/i.test(extractedText);
    console.log(`[Scanner] ============================================`);
    console.log(`[Scanner] EXTRACTED TEXT INSPECTION`);
    console.log(`[Scanner] Has dependent table header: ${hasDepTableHeader}`);
    
    // Extract the dependent table section for inspection
    if (hasDepTableHeader) {
      const depTableMatch = extractedText.match(/type\s+of\s+dependent\s+name\s+effective\s+date([\s\S]{0,1500}?)(?:payment\s+start\s+date|we\s+will\s+remove|dependent\s+adjustments?|combined\s+rating|$)/i);
      if (depTableMatch) {
        const depTableSection = depTableMatch[1];
        const lineCount = (depTableSection.match(/\n/g) || []).length;
        console.log(`[Scanner] Dependent table section found`);
        console.log(`[Scanner]   - Length: ${depTableSection.length} chars`);
        console.log(`[Scanner]   - Newlines: ${lineCount}`);
        console.log(`[Scanner]   - Preview: ${depTableSection.substring(0, 200).replace(/\n/g, ' ')}`);
      }
    }
    console.log(`[Scanner] ============================================\n`);

    // Extract dependent information with monthly amounts (non-fatal)
    let dependentData = {
      dependents: [],
      added: [],
      removed: [],
      changed: [],
      dependentCount: null,
      familyStatus: null,
      totalDependentAmount: 0,
      validationWarnings: []
    };

    try {
      dependentData = extractDependents(extractedText);
    } catch (dependentError) {
      console.warn('[Scanner] Dependent extraction failed, continuing scan:', dependentError.message);
      dependentData.validationWarnings.push({
        message: `Dependent extraction partially failed: ${dependentError.message}`
      });
    }
    console.log(`[Scanner] ============================================`);
    console.log(`[Scanner] DEPENDENT EXTRACTION RESULTS`);
    console.log(`[Scanner] Extracted ${dependentData.dependents?.length || 0} merged dependents, ${dependentData.removed.length} removed dependents`);
    console.log(`[Scanner] Total dependent amount: $${dependentData.totalDependentAmount.toFixed(2)}/month`);
    
    if ((dependentData.dependents?.length || 0) > 0) {
      console.log(`[Scanner] --- Added Dependents ---`);
      (dependentData.dependents || []).forEach((dep, idx) => {
        console.log(`[Scanner] ${idx + 1}. NAME: "${dep.name}" | TYPE: ${dep.type} | AMOUNT: $${(dep.monthlyAmount || 0).toFixed(2)}/mo | EFFECTIVE: ${dep.effectiveDate || 'N/A'} | REMOVAL: ${dep.removalDate || 'N/A'}`);
        console.log(`[Scanner]    Structure: `, JSON.stringify(dep, null, 2));
      });
    } else {
      console.log(`[Scanner] NO DEPENDENTS FOUND in document`);
    }
    
    if (dependentData.removed.length > 0) {
      console.log(`[Scanner] --- Removed Dependents ---`);
      dependentData.removed.forEach((dep, idx) => {
        console.log(`[Scanner] ${idx + 1}. NAME: "${dep.name}" | TYPE: ${dep.type}`);
      });
    }
    
    if (dependentData.validationWarnings && dependentData.validationWarnings.length > 0) {
      console.log(`[Scanner] --- Validation Warnings ---`);
      dependentData.validationWarnings.forEach(warning => {
        console.log(`[Scanner] ⚠️ ${warning.message}`);
      });
    }
    console.log(`[Scanner] ============================================\n`);

    const scanData = scanVaDecision(extractedText);

    const ratingPercent = scanData?.ratingCalculation?.calculatedCombinedRating || 0;
    let computedDependentCompensation = {
      dependents: dependentData.dependents || [],
      compensationTimeline: [],
      dependentAdjustments: [],
      finalMonthlyAmount: 0,
      warnings: []
    };

    if (ratingPercent > 0) {
      computedDependentCompensation = computeDependentCompensation(
        ratingPercent,
        dependentData.dependents || [],
        scanData
      );
    }

    const grantedDetectedSmc = Array.isArray(scanData?.smc?.detectedLevels)
      ? scanData.smc.detectedLevels
          .map((item) => ({
            ...item,
            level: String(item?.level || '').toUpperCase()
          }))
          .filter((item) => !!item.level)
      : [];

    const explicitGrantedSmc = grantedDetectedSmc.map((item) => `${item.level} - ${item.reason || `Explicitly granted SMC-${item.level}`}`);

    let compensation = null;
    try {
      const rating = scanData?.ratingCalculation?.calculatedCombinedRating || 0;
      const currentYear = new Date().getFullYear();
      
      if (rating > 0) {
        const smcCode = getHighestSmcCode(scanData);
        const ancillary = getAncillaryFlags(scanData);
        
        // Calculate compensation using RATE ESCALATOR (automatically uses current year rates)
        const baseRate = getDisabilityAmount(rating, currentYear);
        const smcRate = smcCode ? getSMCRate(smcCode, currentYear) : 0;
        const aidAndAttendanceRate = ancillary.aidAndAttendance ? getAncillaryRate('aidAndAttendance', currentYear) : 0;
        const houseboundRate = ancillary.housebound ? getAncillaryRate('housebound', currentYear) : 0;
        const dependentMonthly = computedDependentCompensation.finalMonthlyAmount > 0
          ? Math.max(0, computedDependentCompensation.finalMonthlyAmount - baseRate)
          : dependentData.totalDependentAmount;
        
        const totalMonthly = baseRate + dependentMonthly + smcRate + aidAndAttendanceRate + houseboundRate;
        
        compensation = {
          summary: {
            totalMonthly,
            totalYearly: totalMonthly * 12,
            year: currentYear,
            smcCode: smcCode || null,
            note: `Rates automatically calculated for ${currentYear} using VA COLA escalation`
          },
          components: {
            base: {
              baseMonthly: baseRate,
              dependentMonthly: dependentMonthly,
              totalMonthly: baseRate + dependentMonthly
            },
            smc: {
              smcMonthly: smcRate,
              code: smcCode
            },
            ancillary: {
              aidAndAttendance: aidAndAttendanceRate,
              housebound: houseboundRate,
              total: aidAndAttendanceRate + houseboundRate
            }
          },
          breakdown: {
            baseMonthly: baseRate,
            dependentMonthly: dependentMonthly,
            smcMonthly: smcRate,
            ancillaryMonthly: aidAndAttendanceRate + houseboundRate,
            totalMonthly,
            totalYearly: totalMonthly * 12
          }
        };
      }
    } catch (compensationError) {
      console.warn('[Scanner] Compensation calculation skipped:', compensationError.message);
    }
    
    const scanResult = {
      success: true,
      data: {
        ...scanData,
        metadata: {
          ...(scanData.metadata || {}),
          fileName: req.file.originalname,
          fileSize: req.file.size,
          pagesScanned: pdf.numPages,
          extractedTextLength: extractedText.length
        },
        smc: {
          ...(scanData.smc || {}),
          detectedLevels: grantedDetectedSmc,
          explicit: explicitGrantedSmc
        },
        dependents: dependentData.dependents || [],
        dependentsDetailed: {
          added: dependentData.added,
          removed: dependentData.removed,
          totalDependentAmount: dependentData.totalDependentAmount,
          validationWarnings: dependentData.validationWarnings || []
        },
        dependentAdjustments: computedDependentCompensation.dependentAdjustments || [],
        compensationTimeline: computedDependentCompensation.compensationTimeline || [],
        finalMonthlyAmount: computedDependentCompensation.finalMonthlyAmount || 0,
        compensationWarnings: computedDependentCompensation.warnings || [],
        extractionSummary: {
          ...(scanData.extractionSummary || {}),
          extractedAt: new Date().toISOString(),
          pagesScanned: pdf.numPages
        }
      },
      compensation,
      quality: {
        confidence: {
          overallConfidence: 85
        }
      },
      processingTime: {
        timestamp: new Date().toISOString()
      }
    };
    
    console.log(
      `[Scanner] Scan complete - found ${scanData.serviceConnected?.length || 0} service-connected, ${scanData.denied?.length || 0} denied, ${scanData.ratingCalculation?.calculatedCombinedRating ?? 0}% rating`
    );
    
    // RESPONSE VALIDATION LOGGING
    console.log(`[Scanner] ============================================`);
    console.log(`[Scanner] RESPONSE TO FRONTEND:`);
    console.log(`[Scanner] - Rating: ${scanData.ratingCalculation?.calculatedCombinedRating ?? 0}%`);
    console.log(`[Scanner] - Compensation Year: ${compensation?.summary?.year || 'N/A'}`);
    const responseDependents = Array.isArray(scanResult.data.dependents)
      ? scanResult.data.dependents
      : (scanResult.data.dependents?.added || []);
    console.log(`[Scanner] - Dependents in response: ${responseDependents.length}`);
    if (responseDependents.length > 0) {
      responseDependents.forEach((dep, idx) => {
        console.log(`  [${idx + 1}] NAME: "${dep.name}" | TYPE: ${dep.type} | MONTHLY: $${(dep.monthlyAmount || 0).toFixed(2)}`);
      });
    }
    console.log(`[Scanner] - Total Dependent Amount: $${scanResult.data.dependentsDetailed?.totalDependentAmount || 0}`);
    if (compensation) {
      console.log(`[Scanner] - Monthly Breakdown: Base $${compensation.breakdown.baseMonthly.toFixed(2)} + Dependents $${compensation.breakdown.dependentMonthly.toFixed(2)} + SMC $${compensation.breakdown.smcMonthly.toFixed(2)} = TOTAL $${compensation.breakdown.totalMonthly.toFixed(2)}`);
    }
    console.log(`[Scanner] ============================================\n`);
    
    res.json(scanResult);
    
  } catch (error) {
    console.error('[Scanner] Error processing PDF:', error.message);
    res.status(500).json({
      success: false,
      error: `Failed to process PDF: ${error.message}`
    });
  }
});

export default router;

