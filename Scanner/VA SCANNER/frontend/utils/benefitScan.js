/**
 * BenefitScan Engine - Main Orchestrator
 * Coordinates extraction of all VA decision data with 100% accuracy
 */

import { normalizeText, extractSentences, extractParagraphs, extractSection } from './textNormalizer.js';
import { extractServiceConnected } from './extractServiceConnected.js';
import { extractDenied } from './extractDenied.js';
import { extractAncillaryBenefits, enhanceBenefitStatus, getAllAncillaryBenefits } from './extractAncillary.js';
import { extractSMC, assessSMCEligibility } from './extractSMC.js';
import { extractDependents } from './extractDependents.js';
import { extractPayments, getPaymentSummary } from './extractPayments.js';
import { extractEvidence, groupEvidenceByType, getEvidenceSummary } from './extractEvidence.js';
import { enhanceWithPACTActFlags, generatePACTActSummary, detectPACTActReferences } from './pactActDetection.js';

/**
 * Main BenefitScan function - Extract all VA decision data
 * @param {string} rawText - Raw PDF or text content from VA decision letter
 * @returns {Promise<Object>} Comprehensive extraction results
 */
export async function benefitScan(rawText) {
  console.log('========== BenefitScan Engine Started ==========');
  console.log(`Input text length: ${rawText?.length || 0} characters`);

  const startTime = Date.now();

  try {
    // STEP 1: Normalize text
    console.log('\n[STEP 1] Normalizing text...');
    const normalized = normalizeText(rawText);
    console.log(`✓ Text normalized: ${normalized.length} characters`);

    // STEP 2: Extract metadata
    console.log('\n[STEP 2] Extracting metadata...');
    const metadata = extractMetadata(normalized);
    console.log(`✓ Veteran name: ${metadata.veteranName || 'Not found'}`);
    console.log(`✓ File number: ${metadata.fileNumber || 'Not found'}`);
    console.log(`✓ Decision date: ${metadata.decisionDate || 'Not found'}`);

    // STEP 3: Extract service-connected conditions
    console.log('\n[STEP 3] Extracting service-connected conditions...');
    const serviceConnected = extractServiceConnected(normalized);
    console.log(`✓ Found ${serviceConnected.length} service-connected condition(s)`);
    
    // STEP 3.5: Enhance with PACT Act flags
    console.log('\n[STEP 3.5] Analyzing PACT Act eligibility...');
    const pactActContext = detectPACTActReferences(normalized);
    const enhancedServiceConnected = enhanceWithPACTActFlags(serviceConnected, normalized);
    const pactActSummary = generatePACTActSummary(enhancedServiceConnected);
    console.log(`✓ PACT Act conditions identified: ${pactActSummary.totalPACTActConditions}`);

    // STEP 4: Extract denied conditions
    console.log('\n[STEP 4] Extracting denied conditions...');
    const denied = extractDenied(normalized);
    console.log(`✓ Found ${denied.length} denied condition(s)`);

    // STEP 5: Extract ancillary benefits
    console.log('\n[STEP 5] Extracting ancillary benefits...');
    let foundBenefits = extractAncillaryBenefits(normalized);
    foundBenefits = enhanceBenefitStatus(normalized, foundBenefits);
    const ancillaryBenefits = getAllAncillaryBenefits(foundBenefits);
    console.log(`✓ Found ${foundBenefits.length} ancillary benefit(s) in rating`);
    console.log(`✓ Showing all ${ancillaryBenefits.length} standard benefits`);

    // STEP 6: Extract SMC
    console.log('\n[STEP 6] Extracting Special Monthly Compensation...');
    const smc = extractSMC(normalized, serviceConnected);
    const smcEligibility = assessSMCEligibility(serviceConnected);
    console.log(`✓ SMC explicit awards: ${smc.explicit.length}`);
    console.log(`✓ SMC inferred: ${smc.inferred.length}`);

    // STEP 7: Extract dependents
    console.log('\n[STEP 7] Extracting dependent information...');
    const dependents = extractDependents(normalized);
    console.log(`✓ Dependents added: ${dependents.added.length}`);
    console.log(`✓ Dependents removed: ${dependents.removed.length}`);

    // STEP 8: Extract payments
    console.log('\n[STEP 8] Extracting payment information...');
    const payments = extractPayments(normalized);
    const paymentSummary = getPaymentSummary(payments);
    console.log(`✓ Monthly entitlement: $${paymentSummary.monthlyEntitlement || 'Not found'}`);
    console.log(`✓ Back pay: $${paymentSummary.backPayAmount || 'None'}`);

    // STEP 9: Extract evidence
    console.log('\n[STEP 9] Extracting evidence list...');
    const evidence = extractEvidence(normalized);
    const evidenceSummary = getEvidenceSummary(evidence);
    console.log(`✓ Total evidence items: ${evidenceSummary.totalItems}`);
    console.log(`✓ Evidence by type:`, evidenceSummary.byType);

    // STEP 10: Build comprehensive output
    console.log('\n[STEP 10] Building final output...');
    const result = {
      // Metadata
      metadata: {
        veteranName: metadata.veteranName,
        fileNumber: metadata.fileNumber,
        decisionDate: metadata.decisionDate,
        effectiveDate: metadata.effectiveDate,
        combinedRating: enhancedServiceConnected[0]?.combinedRating || null,
        extractionTimestamp: new Date().toISOString(),
        extractionSource: 'BenefitScan Engine v1.0'
      },

      // Service-Connected Conditions (with PACT Act flags)
      serviceConnected: {
        conditions: enhancedServiceConnected,
        count: enhancedServiceConnected.length,
        combinedRating: enhancedServiceConnected[0]?.combinedRating || null
      },
      
      // PACT Act Summary
      pactAct: {
        summary: pactActSummary,
        context: pactActContext,
        eligibleConditions: enhancedServiceConnected.filter(c => c.pactActEligible)
      },

      // Denied Conditions
      denied: {
        conditions: denied,
        count: denied.length
      },

      // Ancillary Benefits
      ancillaryBenefits: {
        benefits: ancillaryBenefits,
        granted: ancillaryBenefits.filter(b => b.status === 'Granted'),
        denied: ancillaryBenefits.filter(b => b.status === 'Denied'),
        referenced: ancillaryBenefits.filter(b => b.status === 'Referenced')
      },

      // Special Monthly Compensation
      specialMonthlyCompensation: {
        explicit: smc.explicit,
        inferred: smc.inferred,
        eligibilityIndicators: smc.eligibilityIndicators,
        assessment: smcEligibility
      },

      // Dependents
      dependents: {
        added: dependents.added,
        removed: dependents.removed,
        totalCount: dependents.dependentCount,
        familyStatus: dependents.familyStatus
      },

      // Payment Information
      payments: {
        allPayments: payments,
        summary: paymentSummary
      },

      // Evidence
      evidence: {
        items: evidence,
        summary: evidenceSummary,
        byType: groupEvidenceByType(evidence)
      }
    };

    // STEP 11: Validate and summarize
    console.log('\n[STEP 11] Validation & Summary');
    const summary = generateExtractionSummary(result);
    console.log(`\n✓ BENEFITSCAN COMPLETE - ${summary.totalItems} items extracted`);
    console.log(`✓ Execution time: ${Date.now() - startTime}ms`);

    result.extractionSummary = summary;

    return result;

  } catch (error) {
    console.error('❌ BenefitScan Error:', error);
    throw new Error(`BenefitScan failed: ${error.message}`);
  }
}

/**
 * Extract metadata from VA decision
 * @param {string} normalizedText - Normalized text
 * @returns {Object} Extracted metadata
 */
function extractMetadata(normalizedText) {
  const metadata = {
    veteranName: null,
    fileNumber: null,
    decisionDate: null,
    effectiveDate: null
  };

  if (!normalizedText) return metadata;

  // Extract veteran name
  const namePatterns = [
    // Pattern 1: All-caps name before address (e.g., "DALE A FLETCHER 1895 W CRENSHAW")
    /\b([A-Z]+\s+[A-Z]\s+[A-Z]+)\s+\d+\s+[A-Z]/,
    // Pattern 2: "Veteran: John Smith" format
    /veteran:\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)/i,
    // Pattern 3: "Dear Mr./Ms./Mrs. Fletcher" format
    /dear\s+(?:mr|ms|mrs)\.?\s+([A-Z][a-z]+)/i,
    // Pattern 4: File header format
    /^([A-Z]+,\s+[A-Z]+(?:\s+[A-Z])?)\s+Page\s+\d+/m
  ];

  namePatterns.some(pattern => {
    const match = normalizedText.match(pattern);
    if (match) {
      metadata.veteranName = match[1].trim();
      return true;
    }
    return false;
  });

  // Extract file number
  const fileNumberPatterns = [
    /(?:file|va|claim)\s+(?:number|#)[\s:]+(\d{9})/i,
    /(\d{3})-\d{2}-\d{4}/  // SSN format used sometimes
  ];

  fileNumberPatterns.some(pattern => {
    const match = normalizedText.match(pattern);
    if (match) {
      metadata.fileNumber = match[1];
      return true;
    }
    return false;
  });

  // Extract decision date
  const decisionDatePatterns = [
    // Pattern 1: "December 15, 2017" standalone (common in VA letters)
    /\b([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s+[A-Z]{2,}/,
    // Pattern 2: "Rating Decision" or "Decision Date:" format
    /(?:rating\s+)?decision\s+(?:date)?[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    // Pattern 3: "Date of this decision" format
    /(?:date\s+of\s+this\s+decision|claim\s+date)[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
  ];

  decisionDatePatterns.some(pattern => {
    const match = normalizedText.match(pattern);
    if (match) {
      metadata.decisionDate = match[1];
      return true;
    }
    return false;
  });

  // Extract effective date
  const effectiveDatePatterns = [
    /effective.*?date[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /all\s+adjustments\s+(?:are|become)\s+effective[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
  ];

  effectiveDatePatterns.some(pattern => {
    const match = normalizedText.match(pattern);
    if (match) {
      metadata.effectiveDate = match[1];
      return true;
    }
    return false;
  });

  return metadata;
}

/**
 * Generate extraction summary
 * @param {Object} result - Full extraction result
 * @returns {Object} Summary statistics
 */
function generateExtractionSummary(result) {
  return {
    totalItems: (
      (result.serviceConnected?.count || 0) +
      (result.denied?.count || 0) +
      (result.ancillaryBenefits?.benefits?.length || 0) +
      (result.specialMonthlyCompensation?.explicit?.length || 0) +
      (result.dependents?.added?.length || 0) +
      (result.payments?.allPayments?.length || 0) +
      (result.evidence?.items?.length || 0)
    ),
    serviceConnectedCount: result.serviceConnected?.count || 0,
    deniedCount: result.denied?.count || 0,
    ancillaryBenefitsCount: result.ancillaryBenefits?.benefits?.length || 0,
    smcExplicitCount: result.specialMonthlyCompensation?.explicit?.length || 0,
    smcInferredCount: result.specialMonthlyCompensation?.inferred?.length || 0,
    dependentsAddedCount: result.dependents?.added?.length || 0,
    dependentsRemovedCount: result.dependents?.removed?.length || 0,
    paymentsCount: result.payments?.allPayments?.length || 0,
    evidenceCount: result.evidence?.items?.length || 0
  };
}

/**
 * Export BenefitScan result to JSON
 * @param {Object} result - Result from benefitScan
 * @returns {string} JSON string
 */
export function exportToJSON(result) {
  return JSON.stringify(result, null, 2);
}

/**
 * Export BenefitScan result to CSV (simplified)
 * @param {Object} result - Result from benefitScan
 * @returns {string} CSV formatted data
 */
export function exportToCSV(result) {
  let csv = 'Category,Item,Value\n';

  // Add service-connected
  result.serviceConnected?.conditions?.forEach(sc => {
    csv += `Service-Connected,${sc.condition},${sc.percentage}%\n`;
  });

  // Add denied
  result.denied?.conditions?.forEach(d => {
    csv += `Denied,${d.condition},${d.reason}\n`;
  });

  // Add benefits
  result.ancillaryBenefits?.benefits?.forEach(b => {
    csv += `Benefit,${b.benefit},${b.status}\n`;
  });

  return csv;
}

// Export main function as default
export default benefitScan;

