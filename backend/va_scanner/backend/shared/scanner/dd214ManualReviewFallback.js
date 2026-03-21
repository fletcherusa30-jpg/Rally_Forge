/**
 * DD-214 Manual Review Fallback Module v1.0
 * Structured fallback output for low-confidence documents
 *
 * When deterministic=false and overall confidence <50%, instead of returning
 * sparse/mixed-quality data, return a complete schema with all fields marked
 * as "needs_manual_review" with confidence scores and suggestions for human review.
 *
 * Per .copilot-instructions.md: Production-ready handling of edge cases.
 */

/**
 * Create a manual review stub for a single field
 * Indicates field could not be reliably extracted and needs human validation
 *
 * @param {string} fieldName - Human-readable field name
 * @param {string} block - DD-214 block reference (e.g., "1", "12a", "25")
 * @param {number} confidence - Extraction confidence (0-100)
 * @param {string} suggestion - Optional suggestion for reviewer (e.g., "Check Block 1")
 * @param {string} ocrQuality - Optional OCR quality indicator ('high', 'medium', 'low')
 * @returns {object} Manual review stub
 */
export function createFieldReviewStub(
  fieldName,
  block,
  confidence = 0,
  suggestion = null,
  ocrQuality = 'unknown',
) {
  return {
    value: null,
    needsManualReview: true,
    confidence,
    extractionBlock: block,
    suggestion: suggestion || `Unable to reliably extract from Block ${block}. Please verify manually.`,
    ocrQuality,
    reviewPriority: confidence < 20 ? 'high' : confidence < 50 ? 'medium' : 'low',
  };
}

/**
 * Create a manual review fallback structure for DD-214 extraction
 * Used when document confidence is too low for deterministic processing
 *
 * @param {object} partialExtraction - Partially extracted fields (may be incomplete/low-quality)
 * @param {object} metadata - Extraction metadata
 * @param {number} metadata.confidence - Overall extraction confidence (0-100)
 * @param {string} metadata.reason - Reason for fallback (e.g., "low_ocr_confidence", "missing_critical_fields")
 * @param {string} metadata.documentVariant - Form variant detected
 * @param {string} metadata.ocrProfile - OCR profile used
 * @returns {object} Complete DD-214 schema with all fields marked for manual review
 */
export function createManualReviewFallback(partialExtraction = {}, metadata = {}) {
  const {
    confidence = 0,
    reason = 'low_extraction_confidence',
    documentVariant = 'unknown',
    ocrProfile = 'default',
  } = metadata;

  // Identity Block (1-3)
  const identity = {
    veteranName: createFieldReviewStub('Veteran Name', '1', partialExtraction.veteranName?.confidence || 0, 'Check Block 1 for complete name'),
    ssn: createFieldReviewStub('Social Security Number', '2', partialExtraction.ssn?.confidence || 0, 'Check Block 2 for SSN'),
    dateOfBirth: createFieldReviewStub('Date of Birth', '3', partialExtraction.dateOfBirth?.confidence || 0, 'Check Block 3 for DOB'),
  };

  // Service Information (12-14)
  const serviceDates = {
    dateEnteredActiveDuty: createFieldReviewStub('Entry Date', '12a', partialExtraction.entryDate?.confidence || 0, 'Check Block 12a'),
    separationDate: createFieldReviewStub('Separation Date', '12b', partialExtraction.separationDate?.confidence || 0, 'Check Block 12b'),
    netActiveDuty: createFieldReviewStub('Net Active Service', '12c', partialExtraction.netService?.confidence || 0, 'Check Block 12c for duration'),
    foreignService: createFieldReviewStub('Foreign Service', '12f', partialExtraction.foreignService?.confidence || 0, 'Check Block 12f'),
  };

  const militaryStatus = {
    branchOfService: createFieldReviewStub('Branch of Service', '4-5', partialExtraction.branch?.confidence || 0, 'Check Blocks 4-5 for component/branch'),
    rank: createFieldReviewStub('Rank/Grade', '7', partialExtraction.rank?.confidence || 0, 'Check Block 7'),
    mos: createFieldReviewStub('MOS/AFSC', '11', partialExtraction.mos?.confidence || 0, 'Check Block 11 for primary specialty'),
    serviceComponent: createFieldReviewStub('Service Component', '4', partialExtraction.component?.confidence || 0, 'Check Block 4 for component'),
  };

  const separation = {
    typeOfSeparation: createFieldReviewStub('Type of Separation', '24', partialExtraction.separationType?.confidence || 0, 'Check Block 24 (e.g., Honorable, General)'),
    characterOfDischarge: createFieldReviewStub('Character of Discharge', '24', partialExtraction.dischargeType?.confidence || 0, 'Check Block 24 character code'),
    separationAuthority: createFieldReviewStub('Separation Authority', '25', partialExtraction.separationAuthority?.confidence || 0, 'Check Block 25 for regulation/code'),
    reasonForSeparation: createFieldReviewStub('Reason for Separation', '25-28', partialExtraction.reasonForSeparation?.confidence || 0, 'Check Blocks 25-28'),
  };

  // Assignments & Duties (8, 20)
  const assignments = {
    lastDutyAssignment: createFieldReviewStub('Last Duty Assignment', '8', partialExtraction.lastDutyAssignment?.confidence || 0, 'Check Block 8a'),
    lastRankHeld: createFieldReviewStub('Last Rank Held', '7', partialExtraction.lastRank?.confidence || 0, 'Check Block 7'),
  };

  // Deployments & Combat
  const deployments = {
    deploymentLocations: createFieldReviewStub('Deployment Locations', '18', partialExtraction.deployments?.confidence || 0, 'Check Block 18 and Continuation sheets for locations/dates'),
    combatVeteran: createFieldReviewStub('Combat Veteran Indicator', '18', partialExtraction.combatIndicator?.confidence || 0, 'Check Block 18 for combat indicators (Vietnam, Gulf War, etc.)'),
    hazardousService: createFieldReviewStub('Hazardous Duty Indicators', '18', partialExtraction.hazards?.confidence || 0, 'Check Block 18 for hazard indicators'),
  };

  // Education & Credentials (14)
  const education = {
    militaryEducation: createFieldReviewStub('Military School Attendance', '14', partialExtraction.education?.confidence || 0, 'Check Block 14 for courses and dates'),
  };

  // Awards & Decorations (28)
  const recognitions = {
    awards: createFieldReviewStub('Awards & Decorations', '28', partialExtraction.awards?.confidence || 0, 'Check Block 28 for ribbons and medals'),
    specialQualifications: createFieldReviewStub('Special Qualifications', '18', partialExtraction.specialQualifications?.confidence || 0, 'Check Block 18 for special codes/badges'),
  };

  // Reenlistments (17-18)
  const reenlistments = {
    reenlistmentHistory: createFieldReviewStub('Reenlistment History', '17-18', partialExtraction.reenlistments?.confidence || 0, 'Check Blocks 17-18 for reenlistment periods'),
  };

  // Contact Information (19, 26-27)
  const contact = {
    mailingAddress: createFieldReviewStub('Mailing Address', '26', partialExtraction.mailingAddress?.confidence || 0, 'Check Block 26 for current address'),
    nearestRelative: createFieldReviewStub('Nearest Relative', '27', partialExtraction.nearestRelative?.confidence || 0, 'Check Block 27'),
  };

  // Transfer Command (9)
  const postService = {
    transferCommand: createFieldReviewStub('Transfer Command Info', '9', partialExtraction.transferCommand?.confidence || 0, 'Check Block 9 for USAR/IRR transfer details'),
    postServiceTransfer: createFieldReviewStub('Post-Service Transfer', '19', partialExtraction.postServiceTransfer?.confidence || 0, 'Check Block 19 for transfer instructions'),
  };

  return {
    _metadata: {
      deterministic: false,
      manualReviewRequired: true,
      overallConfidence: confidence,
      fallbackReason: reason,
      documentVariant,
      ocrProfile,
      reviewPriority: confidence < 30 ? 'critical' : confidence < 50 ? 'high' : 'medium',
      message: `Document extraction confidence is below 50% (${confidence.toFixed(1)}%). All fields below require manual verification.`,
      suggestedAction: 'Manual review by trained staff required. Verify each field against source document.',
    },
    identification: identity,
    serviceDates,
    militaryStatus,
    separation,
    assignments,
    deployments,
    education,
    recognitions,
    reenlistments,
    contact,
    postService,
    notes: createFieldReviewStub('Remarks & Programs', '18', 0, 'Check Block 18 and continuation sheets for remarks'),
  };
}

/**
 * Check if extraction should fall back to manual review mode
 * Criteria:
 * - deterministic checks failed (allChecksPassed=false) AND confidence < 50%, OR
 * - Critical fields are entirely missing AND confidence < 30%
 *
 * @param {object} extraction - Parsed extraction result
 * @param {object} deterministics - Validation result with allChecksPassed property
 * @returns {boolean} True if manual review fallback should be used
 */
export function shouldFallbackToManualReview(extraction = {}, deterministics = {}) {
  const { confidence = 0 } = extraction;
  const { allChecksPassed = true } = deterministics;

  // Fallback if deterministic checks failed AND confidence is low
  if (!allChecksPassed && confidence < 50) {
    return true;
  }

  // Check for missing critical fields
  const criticalFields = [
    extraction.veteranName,
    extraction.entryDate,
    extraction.separationDate,
    extraction.branch,
    extraction.rank,
  ];

  const missingCritical = criticalFields.filter((f) => !f).length;

  // Fallback if >50% of critical fields are missing AND confidence <30%
  if (missingCritical > criticalFields.length * 0.5 && confidence < 30) {
    return true;
  }

  return false;
}

/**
 * Enhance extraction output with manual review fallback when appropriate
 * Called from dd214Analysis/index.js after primary extraction
 *
 * @param {object} parsedExtraction - Raw parsed extraction
 * @param {object} metadata - Extraction metadata
 * @param {number} metadata.confidence - Overall confidence score
 * @param {boolean} metadata.allChecksPassed - Whether all deterministic checks passed
 * @param {string} metadata.variant - Form variant type
 * @param {string} metadata.ocrProfile - OCR profile used
 * @returns {object} Either enhanced extraction or manual review fallback
 */
export function applyManualReviewFallback(parsedExtraction = {}, metadata = {}) {
  const { confidence = 0, allChecksPassed = true, variant = 'unknown', ocrProfile = 'default' } = metadata;

  // Check if fallback should be applied
  if (!shouldFallbackToManualReview(parsedExtraction, { confidence, allChecksPassed })) {
    // No fallback needed; return original
    return parsedExtraction;
  }

  // Create manual review fallback structure
  return createManualReviewFallback(parsedExtraction, {
    confidence,
    reason: !allChecksPassed ? 'deterministic_validation_failed' : 'missing_critical_fields',
    documentVariant: variant,
    ocrProfile,
  });
}

/**
 * Format manual review fallback for UI display
 * Converts field review stubs into a user-friendly report
 *
 * @param {object} fallback - Manual review fallback structure
 * @returns {object} UI-friendly report
 */
export function formatManualReviewReport(fallback = {}) {
  const fieldsByPriority = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  // Collect all review fields
  const collectFields = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;

    Object.entries(obj).forEach(([key, value]) => {
      if (value && value.needsManualReview && value.reviewPriority) {
        fieldsByPriority[value.reviewPriority].push({
          name: key,
          path: path ? `${path}.${key}` : key,
          ...value,
        });
      }
    });
  };

  collectFields(fallback.identification, 'identification');
  collectFields(fallback.serviceDates, 'serviceDates');
  collectFields(fallback.militaryStatus, 'militaryStatus');
  collectFields(fallback.separation, 'separation');
  collectFields(fallback.assignments, 'assignments');
  collectFields(fallback.deployments, 'deployments');
  collectFields(fallback.education, 'education');
  collectFields(fallback.recognitions, 'recognitions');
  collectFields(fallback.reenlistments, 'reenlistments');
  collectFields(fallback.contact, 'contact');
  collectFields(fallback.postService, 'postService');

  return {
    metadata: fallback._metadata,
    fieldsByPriority,
    totalFieldsNeedingReview: Object.values(fieldsByPriority).reduce((sum, arr) => sum + arr.length, 0),
  };
}

export default {
  createFieldReviewStub,
  createManualReviewFallback,
  shouldFallbackToManualReview,
  applyManualReviewFallback,
  formatManualReviewReport,
};
