import { detectSMC, inferSMC } from './smc-detector.js';
import { detectAncillaryBenefits } from './ancillary-benefits-detector.js';
import { detectServiceConnectionType } from '../knowledge/cfr-part3-rules.js';
import { normalizeToCFRTerminology, checkBilateralApplicability } from '../knowledge/cfr-part4-rules.js';
import { extractClaimantInfo } from '../frontend/utils/extractClaimantInfo.js';
import { extractTDIU } from '../frontend/utils/extractTDIU.js';
import { extractCombatStatus } from '../frontend/utils/extractCombatStatus.js';

const SCANNER_VERSION = "4.2.0-cfr-aware-upgrade";

// ============================================================================
// VA DISABILITY MATH - 38 CFR §4.25 & §4.26
// ============================================================================

/**
 * Calculate combined rating per 38 CFR §4.25 (Combined Ratings Table)
 * 
 * Core Rule (Whole-Person Concept):
 * - Veteran is considered 100% efficient
 * - Each disability reduces remaining efficiency, not original 100%
 * - Disabilities combined from highest to lowest
 * - Final values rounded to nearest 10%:
 *   - Values 1-4 round down
 *   - Values 5-9 round up
 * 
 * @param {number[]} ratings - Array of disability percentages
 * @param {boolean} shouldRound - Whether to round result to nearest 10% (default: true)
 * @returns {number} Combined rating (rounded if shouldRound=true)
 */
const calculateCombinedRating = (ratings, shouldRound = true) => {
  if (!Array.isArray(ratings) || ratings.length === 0) return 0;
  const sorted = ratings.filter(r => r > 0 && r <= 100).sort((a, b) => b - a);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return shouldRound ? roundToNearest10(sorted[0]) : sorted[0];

  // 38 CFR §4.25 Combined Ratings Table equivalent:
  // combine highest to lowest and round to whole percent at each step.
  let combinedValue = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    const rating = sorted[index];
    combinedValue = Math.round(combinedValue + ((100 - combinedValue) * rating) / 100);
  }
  
  // Round to nearest 10% per §4.25 (unless caller needs exact value for further calculations)
  return shouldRound ? roundToNearest10(combinedValue) : combinedValue;
};

/**
 * Round to nearest 10% per 38 CFR §4.25
 * Values ending in 1-4 round down, 5-9 round up
 */
const roundToNearest10 = (value) => {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value / 10) * 10;
  return Math.max(0, Math.min(100, rounded));
};

/**
 * Calculate combined rating with bilateral factor per 38 CFR §4.26
 * 
 * Bilateral Factor Rule:
 * 1. Combine left and right disabilities first (§4.25)
 * 2. Calculate 10% of that combined value
 * 3. ADD (not combine) this 10% to the bilateral subtotal
 * 4. Treat result as one single disability
 * 5. Combine with remaining disabilities
 * 6. Round final result to nearest 10%
 * 
 * @param {Array} conditions - Array of condition objects with percentage and laterality
 * @returns {Object} Calculation breakdown with bilateral adjustment
 */
const calculateWithBilateralFactor = (conditions) => {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return {
      hasBilateralPairs: false,
      bilateralCalculation: null,
      regularCombined: 0,
      bilateralAdjustedCombined: 0,
      bilateralPairs: []
    };
  }

  const resolveBilateralGroupKey = (condition) => {
    const text = String(condition?.condition || "").toLowerCase();
    const laterality = condition?.laterality;
    if (laterality !== "left" && laterality !== "right") return null;

    if (/(shoulder|arm|elbow|forearm|wrist|hand|finger|thumb|clavicle|scapula|radicular)/i.test(text)) {
      return "upper_extremities";
    }
    if (/(hip|thigh|knee|leg|ankle|foot|toe|hallux|patellofemoral|sciatic)/i.test(text)) {
      return "lower_extremities";
    }
    if (/(eye|vision|optic|retina|lens|cornea|pupil|iris)/i.test(text)) {
      return "paired_eyes";
    }
    if (/(ear|hearing|auditory|cochlear|mastoid)/i.test(text)) {
      return "paired_ears";
    }
    if (/(kidney|lung|ovary|testicle|breast)/i.test(text)) {
      return "paired_organs";
    }

    return condition?.bilateralPair || null;
  };

  const bilateralGroups = {};
  conditions.forEach((condition) => {
    const groupKey = resolveBilateralGroupKey(condition);
    if (!groupKey) return;
    if (!bilateralGroups[groupKey]) {
      bilateralGroups[groupKey] = [];
    }
    bilateralGroups[groupKey].push(condition);
  });
  
  const bilateralPairs = [];
  const bilateralCombinedRatings = [];
  const consumedInBilateral = new Set();
  
  // Process each bilateral pair
  Object.keys(bilateralGroups).forEach(bodyPart => {
    const group = bilateralGroups[bodyPart];
    const compensableGroup = group.filter((condition) => Number.isFinite(condition.percentage) && condition.percentage > 0);
    const hasCompensableLeft = compensableGroup.some((condition) => condition.laterality === 'left');
    const hasCompensableRight = compensableGroup.some((condition) => condition.laterality === 'right');

    if (compensableGroup.length >= 2 && hasCompensableLeft && hasCompensableRight) {
      // Step 1: Combine the bilateral ratings WITHOUT rounding (exact value needed)
      const ratings = compensableGroup.map(c => c.percentage);
      const bilateralExact = calculateCombinedRating(ratings, false); // Don't round yet
      
      // Step 2: Calculate 10% of bilateral combined value  
      const bilateralFactor = bilateralExact * 0.10;
      
      // Step 3: ADD (not combine) the 10% factor
      const bilateralWithFactor = bilateralExact + bilateralFactor;
      
      bilateralPairs.push({
        bodyPart,
        conditions: compensableGroup,
        ratings,
        bilateralCombined: Number(bilateralExact.toFixed(2)),
        bilateralFactor: Number(bilateralFactor.toFixed(2)),
        bilateralWithFactor: Number(bilateralWithFactor.toFixed(2))
      });

      compensableGroup.forEach((condition) => consumedInBilateral.add(condition));
      
      bilateralCombinedRatings.push(bilateralWithFactor);
    }
  });
  
  const hasBilateralPairs = bilateralPairs.length > 0;
  
  // Calculate regular combined rating (no bilateral adjustment)
  const allRatings = conditions.map(c => c.percentage).filter(r => r > 0);
  const regularCombinedExact = calculateCombinedRating(allRatings, false);
  const regularCombined = roundToNearest10(regularCombinedExact);
  
  // Calculate with bilateral factor if applicable
  let bilateralAdjustedCombinedExact = regularCombinedExact;
  let bilateralAdjustedCombined = regularCombined;
  
  if (hasBilateralPairs) {
    // Combine all bilateral-adjusted ratings with non-bilateral ratings
    const nonBilateralRatings = conditions
      .filter((condition) => !consumedInBilateral.has(condition))
      .map((condition) => condition.percentage)
      .filter((rating) => rating > 0);
    const allAdjustedRatings = [...bilateralCombinedRatings, ...nonBilateralRatings];
    bilateralAdjustedCombinedExact = calculateCombinedRating(allAdjustedRatings, false);
    bilateralAdjustedCombined = roundToNearest10(bilateralAdjustedCombinedExact);
  }
  
  return {
    hasBilateralPairs,
    bilateralPairs,
    regularCombined,
    bilateralAdjustedCombined,
    bilateralBonus: hasBilateralPairs ? Number((bilateralAdjustedCombinedExact - regularCombinedExact).toFixed(2)) : 0
  };
};

/**
 * Generate human-readable calculation steps for transparency
 * Shows exactly how the combined rating was calculated per CFR
 */
const generateCalculationSteps = (conditions, bilateralCalc) => {
  const steps = [];
  
  if (!conditions || conditions.length === 0) {
    return ['No service-connected conditions to combine'];
  }
  
  if (bilateralCalc.hasBilateralPairs) {
    steps.push('=== 38 CFR §4.25 + §4.26 (WITH BILATERAL FACTOR) ===');
    steps.push('');
    
    // Show bilateral pairs first
    bilateralCalc.bilateralPairs.forEach((pair, idx) => {
      steps.push(`Bilateral Pair ${idx + 1}: ${pair.bodyPart}`);
      pair.conditions.forEach(c => {
        steps.push(`  - ${c.condition}: ${c.percentage}%`);
      });
      steps.push(`  Combined (§4.25): ${pair.bilateralCombined}%`);
      steps.push(`  Bilateral Factor (10%): +${pair.bilateralFactor}%`);
      steps.push(`  Bilateral Total: ${pair.bilateralWithFactor}%`);
      steps.push('');
    });
    
    steps.push('Final Combination:');
    steps.push(`  Regular combined: ${bilateralCalc.regularCombined}%`);
    steps.push(`  With bilateral factor: ${bilateralCalc.bilateralAdjustedCombined}%`);
    steps.push(`  Bilateral bonus: +${bilateralCalc.bilateralBonus}%`);
  } else {
    steps.push('=== 38 CFR §4.25 (STANDARD COMBINED RATINGS) ===');
    steps.push('');
    
    const sorted = conditions
      .map(c => ({ condition: c.condition, percentage: c.percentage }))
      .filter(c => c.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage);
    
    steps.push('Conditions (highest to lowest):');
    sorted.forEach((c, idx) => {
      steps.push(`  ${idx + 1}. ${c.condition}: ${c.percentage}%`);
    });
    steps.push('');
    steps.push(`Combined rating: ${bilateralCalc.regularCombined}%`);
  }
  
  return steps;
};

// Detect bilateral conditions per 38 CFR 4.25 and 4.26
// Enhanced to include all paired extremities and organs per VA rating guidelines
const isBilateralCondition = (condition) => {
  const bilateralParts = [
    // Upper extremities
    'shoulder', 'arm', 'elbow', 'forearm', 'wrist', 'hand', 'finger', 'thumb',
    // Lower extremities  
    'hip', 'thigh', 'knee', 'leg', 'ankle', 'foot', 'toe',
    // Paired sensory organs
    'eye', 'vision', 'optic', 'retina', 'ear', 'hearing', 'tinnitus', 'mastoid',
    // Other paired structures
    'kidney', 'lung', 'testicle', 'ovary', 'breast'
  ];
  
  const text = condition.toLowerCase();
  
  // Check for explicit "bilateral" keyword
  if (/\bbilateral\b/.test(text)) {
    return bilateralParts.some(part => text.includes(part));
  }
  
  // Check for laterality indicators (left/right/dominant/non-dominant)
  const hasLaterality = /\b(left|right|dominant|non-dominant)\b/.test(text);
  
  return bilateralParts.some(part => text.includes(part)) && hasLaterality;
};

const extractLaterality = (condition) => {
  const condLower = condition.toLowerCase();
  
  // Handle explicit bilateral keyword first
  if (/\bbilateral\b|\bboth\s+sides\b/.test(condLower)) {
    return 'bilateral';
  }
  
  // Check for non-dominant FIRST before dominant to avoid false matches
  // Also check for explicit "left side" and "right side" phrasing
  if (/\bleft\b|\b(?:non-dominant|non-dominat)\b|\bleft\s*side\b/.test(condLower)) {
    return 'left';
  }
  if (/\bright\b|\bdominant\b|\bright\s*side\b/.test(condLower)) {
    return 'right';
  }
  
  // Handle appendage notation (e.g., foot/l, hand/R)
  if (/\/l(?:\s|$)|per\s+left/i.test(condition)) {
    return 'left';
  }
  if (/\/r(?:\s|$)|per\s+right/i.test(condition)) {
    return 'right';
  }
  
  return null;
};

const bilateralBodyPartTerms = [
  // Upper extremities - comprehensive
  'shoulder', 'arm', 'elbow', 'forearm', 'wrist', 'hand', 'finger', 'thumb',
  // Lower extremities - comprehensive
  'hip', 'thigh', 'knee', 'leg', 'ankle', 'foot', 'toe',
  // Paired sensory organs - expanded
  'eye', 'vision', 'optic', 'retina', 'lens', 'cornea', 'pupil', 'iris',
  'ear', 'hearing', 'auditory', 'tinnitus', 'mastoid', 'cochlear',
  // Paired internal organs
  'kidney', 'lung', 'lobe', 'testicle', 'ovary', 'breast', 'gland',
  // Joints and bone pairs
  'joint', 'elbow joint', 'ankle joint', 'wrist joint',
  // Skin conditions (paired areas)
  'dermatitis', 'eczema', 'psoriasis',
  // Vascular pairs
  'artery', 'vein', 'vessel'
];

const extractBilateralBodyPart = (condition = '') => {
  const normalized = condition.toLowerCase();
  return bilateralBodyPartTerms.find((term) => normalized.includes(term)) || null;
};

const isCompensableRating = (value) => Number.isFinite(value) && value > 0;

const normalizeText = (raw) =>
  raw
    ?.replace(/\r/g, "")
    .replace(/[–—]/g, "-")
    .replace(/(^|\n)\s*l\s+(?=[A-Z])/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .trim() || "";

const normalizeTextWithLines = (raw) =>
  raw
    ?.replace(/\r/g, "")
    .replace(/[–—]/g, "-")
    .replace(/(^|\n)\s*l\s+(?=[A-Z])/g, "$1")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || "";

const matchAll = (text, pattern, flags = "gi") => {
  const re = new RegExp(pattern, flags);
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m);
  return out;
};

/**
 * Enhanced classifier with confidence scoring and fallback logic
 * 
 * CLASSIFICATION LOGIC:
 * 1. First check if document has rating decision indicators
 * 2. Only reject NOD/appeal forms if they LACK rating decision content
 * 3. Allow rating decisions that happen to mention appeals process
 * 4. Log confidence scores for borderline cases
 * 
 * @param {string} text - Document text to classify
 * @returns {boolean} - True if document is processable as rating decision
 */
const looksLikeRatingDecisionNarrative = (text) => {
  const lowered = text.toLowerCase();
  
  // Define rating decision indicators
  const ratingCues = [
    { name: 'Rating Decision', pattern: /rating\s+decision/i, weight: 3 },
    { name: 'Service Connection', pattern: /service\s+connection\s+(?:for|is)/i, weight: 2 },
    { name: 'Granted/Denied with %', pattern: /(?:granted|denied)\s+(?:with\s+)?(?:an\s+)?evaluation\s+of\s+\d{1,3}\s*(?:%|percent)/i, weight: 3 },
    { name: 'Granted and Rated At', pattern: /granted\s+and\s+rated\s+at\s+\d{1,3}\s*(?:%|percent)/i, weight: 3 },
    { name: 'Combined Rating', pattern: /combined\s+(?:disability\s+)?rating/i, weight: 2 },
    { name: 'Decision Date', pattern: /decision\s+date/i, weight: 1 },
    { name: 'Effective Date', pattern: /effective\s+date/i, weight: 2 },
    { name: 'File Number', pattern: /file\s+number/i, weight: 1 },
    { name: 'Disability Percentage', pattern: /\d{1,3}\s*percent\s*disabled?/i, weight: 2 },
    { name: 'VA Decision', pattern: /\b(?:department|dept\.?)\s+of\s+veterans\s+affairs.*(?:decision|rating)/is, weight: 2 }
  ];
  
  // Calculate rating decision confidence score
  let ratingScore = 0;
  let matchedCues = [];
  
  ratingCues.forEach(cue => {
    if (cue.pattern.test(lowered)) {
      ratingScore += cue.weight;
      matchedCues.push(cue.name);
    }
  });
  
  // Define Notice of Disagreement / Appeal form indicators
  const nodCues = [
    { name: 'Notice of Disagreement', pattern: /notice\s+of\s+disagreement/i, weight: 2 },
    { name: 'VA Form 10182', pattern: /va\s+form\s+10182/i, weight: 3 },
    { name: 'Appeal Process Election', pattern: /appeal\s+process\s+election/i, weight: 2 },
    { name: 'Board of Veterans Appeals', pattern: /board\s+of\s+veterans\s+appeals/i, weight: 1 },
    { name: 'Supplemental Claim', pattern: /supplemental\s+claim/i, weight: 1 },
    { name: 'Higher-Level Review', pattern: /higher-level\s+review/i, weight: 1 }
  ];
  
  // Calculate NOD/appeal confidence score
  let nodScore = 0;
  let matchedNodCues = [];
  
  nodCues.forEach(cue => {
    if (cue.pattern.test(lowered)) {
      nodScore += cue.weight;
      matchedNodCues.push(cue.name);
    }
  });
  
  // Count explicit condition ratings (e.g., "service connection for X is granted and rated at Y%")
  // If there are multiple, it's almost certainly a rating decision
  const ratedConditionCount = (lowered.match(/service\s+connection\s+for\s+.+?(?:is\s+granted\s+and\s+rated\s+at|is\s+granted|granted)/gi) || []).length;
  const hasMultipleRatedConditions = ratedConditionCount >= 2;
  
  // DECISION LOGIC:
  // - If rating score >= 4: Accept (strong rating decision indicators)
  // - If rating score < 4 AND nod score > rating score: Reject (primarily appeal form)
  // - If rating score >= 2 AND nod score <= rating score: Accept (rating decision that mentions appeals)
  // - If document has 3+ rated conditions with "granted" keywords: Accept (strong condition grant pattern)
  // - Otherwise: Reject (insufficient indicators)
  
  const isRatingDecision = ratingScore >= 4 || (ratingScore >= 2 && nodScore <= ratingScore) || (hasMultipleRatedConditions && ratedConditionCount >= 3);
  const confidence = ratingScore / (ratingScore + nodScore) || 0;
  
  // Log classification decision for diagnostics
  if (ratingScore > 0 || nodScore > 0) {
    console.log('[Classifier] Document Classification:');
    console.log(`  Rating Decision Score: ${ratingScore} (matched: ${matchedCues.join(', ') || 'none'})`);
    console.log(`  NOD/Appeal Score: ${nodScore} (matched: ${matchedNodCues.join(', ') || 'none'})`);
    console.log(`  Confidence: ${(confidence * 100).toFixed(1)}% rating decision`);
    console.log(`  Decision: ${isRatingDecision ? 'ACCEPT' : 'REJECT'} as rating decision`);
    
    if (isRatingDecision && nodScore > 0) {
      console.log(`  ℹ️  Note: Rating decision that mentions appeals process (allowed)`);
    }
    if (!isRatingDecision && ratingScore > 0) {
      console.log(`  ⚠️  Warning: Document has some rating indicators but appears to be appeal form`);
    }
  }
  
  return isRatingDecision;
};

const safeNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * ANATOMICAL STRUCTURE MAPPING
 * Maps condition keywords to primary anatomical region
 */
const ANATOMICAL_STRUCTURES = {
  spine: [
    'cervical', 'thoracic', 'lumbar', 'lumbosacral', 'thoracolumbar', 
    'spine', 'spinal', 'vertebra', 'disc', 'disk', 'spondylosis', 'stenosis'
  ],
  foot: [
    'foot', 'feet', 'hallux', 'toe', 'toes', 'tarsal', 'metatarsal',
    'ankle', 'plantar', 'heel', 'bunion'
  ],
  upper_extremity: [
    'shoulder', 'arm', 'elbow', 'forearm', 'wrist', 'hand', 'fingers', 'thumb',
    'clavicle', 'scapula', 'radicular', 'nerve', 'brachial', 'carpal'
  ],
  lower_extremity: [
    'hip', 'thigh', 'knee', 'leg', 'patell', 'femoral', 'sciatic', 'iliac'
  ],
  scar: [
    'scar', 'laceration', 'surgical', 'keloid'
  ]
};

/**
 * PATHOLOGY KEYWORDS
 * Words that describe conditions, not structures
 */
const PATHOLOGY_KEYWORDS = [
  'arthritis', 'osteoarthritis', 'rheumatoid', 'degenerative', 'degeneration',
  'spondylosis', 'spondylitic', 'stenosis', 'hypertrophy', 'herniation', 'hernia',
  'bulge', 'prolapse', 'displacement', 'disease', 'ddd', 'disc', 'disk',
  'ligamentum', 'flavum', 'impingement', 'syndrome', 'pain', 'palsy', 'paralysis',
  'contracture', 'ankylosis', 'fusion', 'stiffness', 'laxity', 'instability',
  'subluxation', 'dislocation', 'fracture', 'sprain', 'strain', 'tear', 'rupture',
  'inflammation', 'inflamed', 'edema', 'swelling', 'hemorrhage', 'bleed'
];

/**
 * Detect the primary anatomical structure in a condition description
 */
const detectAnatomicalStructure = (text) => {
  const lower = text.toLowerCase();
  for (const [structure, keywords] of Object.entries(ANATOMICAL_STRUCTURES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return structure;
    }
  }
  return null;
};

/**
 * Extract pathologies (non-anatomical medical terms) from text
 */
const extractPathologies = (text) => {
  const words = text.toLowerCase().split(/[\s;,]+/);
  return words.filter(w => 
    PATHOLOGY_KEYWORDS.some(pk => w.includes(pk)) && w.length > 2
  );
};

/**
 * RULE 5: Never treat "ligamentum flavum" as standalone
 * Always merge it into parent spine condition
 */
const hasLigamentumFlavum = (text) => 
  /ligamentum\s+flavum|flavum\s+hypertrophy/i.test(text);

/**
 * Smart condition splitting that respects anatomical boundaries
 * RULE 2/3: Split ONLY on structural boundaries OR different anatomy
 */
const smartSplitConditions = (bulletText) => {
  // RULE 1: Do NOT split on semicolons alone
  // Semicolons are descriptive, not structural
  
  // Extract percentage if present (for later)
  const percentMatch = bulletText.match(/(\d{1,3})\s*%/);
  const percentage = percentMatch ? percentMatch[1] : null;
  
  // Remove percentage from analysis (will add back later)
  let textWithoutPercent = bulletText.replace(/\s*(\d{1,3})\s*%.*$/, '');
  
  // Split ONLY on explicit anatomical boundaries:
  // e.g., "left hallux valgus; left foot degenerative arthritis" 
  //       → two different structures (hallux vs foot)
  
  // First, try to detect if this is multiple distinct anatomical regions
  const parts = textWithoutPercent.split(/;\s*(?=[a-z])/i);
  
  if (parts.length === 1) {
    // Single condition - don't split
    return [{
      text: textWithoutPercent.trim(),
      percentage
    }];
  }
  
  // Multiple parts - check if they're different anatomical structures
  const structuresFound = {};
  const conditions = [];
  
  parts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    
    const struct = detectAnatomicalStructure(trimmed);
    
    // If we've seen this structure before, merge with previous
    if (struct && structuresFound[struct]) {
      // Merge into existing condition
      const idx = conditions.findIndex(c => detectAnatomicalStructure(c.text) === struct);
      if (idx >= 0) {
        // Add pathologies to the existing condition
        conditions[idx].text = conditions[idx].text + '; ' + trimmed;
      }
    } else {
      // New structure or no structure detected
      if (struct) structuresFound[struct] = true;
      conditions.push({
        text: trimmed,
        percentage
      });
    }
  });
  
  return conditions;
};

/**
 * Merge pathologies within the same anatomical structure
 * RULE 4: Multiple pathologies of same structure = ONE disability
 */
const mergePathologiesInCondition = (conditionText) => {
  // For spine conditions with "ligamentum flavum", merge into parent
  if (hasLigamentumFlavum(conditionText) && /spine|cervical|thoracic|lumbar/i.test(conditionText)) {
    // It's already together, just normalize
    return conditionText
      .replace(/;\s*/g, '; ')  // Normalize semicolons with spaces
      .trim();
  }
  
  // For other cases, keep pathologies grouped by structure
  const parts = conditionText.split(/;\s*/);
  const struct = detectAnatomicalStructure(conditionText);
  
  if (struct) {
    // Filter to keep only this structure's pathologies
    const relevantParts = parts.filter(p => 
      detectAnatomicalStructure(p) === struct || 
      PATHOLOGY_KEYWORDS.some(pk => p.toLowerCase().includes(pk))
    );
    return relevantParts.join('; ').trim();
  }
  
  return conditionText.trim();
};

const cleanCondition = (value) => {
  let cleaned = String(value || "");
  
  // IMPORTANT: Do NOT remove content after semicolons
  // Semicolons are descriptive and contain important pathology information
  
  cleaned = cleaned
    .replace(/^\s*(?:[l•·-])\s+/i, "")
    .replace(/^\s*(?:service connection for|entitlement to service connection for|evaluation for)\s+/i, "")
    .replace(/\s*\(claimed as.*?\)/i, "")
    .replace(/\s*\(also.*?\)/i, "")
    .replace(/\s*\(see.*?\)/i, "")
    .replace(/\s*\{.*?\}/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\s*-\s*(?:decision|order|conclusion|effective|awarded|rated|evaluated)\b.*$/i, "")
    .replace(/\s*effective.*$/i, "")
    .replace(/\s*with\s+an?\s+evaluation.*$/i, "")
    .replace(/\s*rated\s+at.*$/i, "")
    .replace(/\s*is\s+granted.*$/i, "")
    .replace(/\s*is\s+conceded\s+and.*$/i, "")
    .replace(/\s*is\s+amended\s+to.*$/i, "")
    .replace(/\s*-\s*amended\s+to.*$/i, "")
    .replace(/\s*is\s+reentitlement\s+at.*$/i, "")
    .replace(/\s*-\s*reentitlement\s+at.*$/i, "")
    .replace(/\s*(?:was|is)\s+increased\s+to.*$/i, "")
    .replace(/\s*(?:was|is)\s+determined.*$/i, "")
    .replace(/\s*is\s+now(?:-evaluated)?.*$/i, "")
    .replace(/\s*is\s+denied.*$/i, "")
    .replace(/\s*(?:proposed\s+but\s+)?denied.*$/i, "")
    .replace(/\s+is$/i, "")
    .replace(/\s+proposed\s+but$/i, "")
    .replace(/\/\w+\s*$/, "")
    .replace(/[\s\-–—:,.]+$/g, "")  // Remove trailing punctuation but NOT semicolons (they're kept!)
    .replace(/\s{2,}/g, " ")
    .trim();
  
  // Apply pathology merging for same-structure conditions
  cleaned = mergePathologiesInCondition(cleaned);
  
  return cleaned;
};

const extractSection = (text, startPattern, endPatterns) => {
  const start = text.search(startPattern);
  if (start < 0) return "";
  const tail = text.slice(start + text.match(startPattern)[0].length);
  const endIndex = endPatterns
    .map((pattern) => tail.search(pattern))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];
  return endIndex >= 0 ? tail.slice(0, endIndex) : tail;
};

const normalizeConditionKey = (value) =>
  cleanCondition(value)
    .replace(/\s*\([^)]*\)/g, "")  // Remove parenthetical abbreviations before normalizing
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isNoiseCondition = (value) => {
  const text = normalizeConditionKey(value);
  if (!text || text.length < 3) return true;
  // Reject if too long (likely form text or multiple conditions)
  if (text.length > 150) return true;
  // Comprehensive VA form boilerplate detection
  const boilerplatePatterns = [
    /notice of disagreement/i,
    /privacy act/i,
    /omb approved/i,
    /respondent burden/i,
    /appeal|appellate review/i,
    /regional office/i,
    /effective date of award/i,
    /payment|compensation/i,
    /certification and signature/i,
    /instructions|instruction/i,
    /respondent burden/i,
    /form \d+|va form/i,
    /please (check|select|list|note|refer|utilize)/i,
    /you (can|may|must|should|are|were)/i,
    /item \d+/i,
    /part (i|ii|iii|iv|v|vi|vii|viii)/i,
    /the law provides/i,
    /accredited representative/i,
    /crisis line/i,
    /to assist please/i,
    /information about/i,
    /you believe to be the result of your military service/i,
    /federal register/i,
    /code of federal regulations/i,
    /claimed as .*is granted/i, // Catches malformed extractions
    /your claim|your disability/i
  ];
  return boilerplatePatterns.some(pattern => pattern.test(value));
};

const dedupeByConditionAndRating = (items) => {
  const seen = new Set();
  const out = [];
  
  items.forEach((item) => {
    const key = `${normalizeConditionKey(item.condition)}|${item.percentage ?? item.rating ?? ""}`;
    if (!key || seen.has(key)) return;
    if (isNoiseCondition(item.condition)) return;
    
    // RULE 5: Never extract "ligamentum flavum" or "flavum" as standalone disability
    const isFlavumStandalone = /^\s*flavum\s*$/i.test(item.condition) || 
                               /^\s*ligamentum\s+flavum\s*$/i.test(item.condition);
    if (isFlavumStandalone) return;  // Skip standalone flavum
    
    seen.add(key);
    out.push(item);
  });
  
  // Second pass: filter conditions that are fragments of longer conditions at same rating
  // RULE 5: Remove standalone pathologies when they're contained in a longer condition
  return out.filter((item, idx) => {
    const itemNorm = normalizeConditionKey(item.condition);
    const itemRating = item.percentage ?? item.rating;
    
    // Check for common pathology fragments that should be merged
    const pathologyFragments = [
      'flavum', 'spondylosis', 'stenosis', 'arthritis', 'degenerative arthritis',
      'arthropathy', 'hypertrophy'
    ];
    
    // If this item is a pathology fragment, check if it's contained in a parent condition
    const isFragment = pathologyFragments.some(frag => 
      normalizeConditionKey(frag) === itemNorm || itemNorm.includes(frag)
    );
    
    if (isFragment) {
      const hasParentCondition = out.some((other, otherIdx) => {
        if (otherIdx === idx) return false;
        const otherNorm = normalizeConditionKey(other.condition);
        const otherRating = other.percentage ?? other.rating;
        // Check if this item's text is contained in a longer condition with same rating
        return otherNorm.includes(itemNorm) && 
               otherRating === itemRating && 
               otherNorm.length > itemNorm.length;
      });
      if (hasParentCondition) return false;
    }
    
    // Also filter very short items that are substrings of longer ones at same rating
    if (itemNorm.split(' ').length <= 2 && itemNorm.length < 20) {
      const hasLongerMatch = out.some((other, otherIdx) => {
        if (otherIdx === idx) return false;
        const otherNorm = normalizeConditionKey(other.condition);
        const otherRating = other.percentage ?? other.rating;
        return otherNorm.includes(itemNorm) && otherRating === itemRating && otherNorm.length > itemNorm.length;
      });
      if (hasLongerMatch) return false;
    }
    
    return true;
  });
};

function extractMetadata(text) {
  // Extract Rating Decision Date - this is when VA made the decision
  const ratingDecisionDate =
    (text.match(/Rating Decision\s+(?:D|d)ated[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/i) || [])[1] ||
    (text.match(/Rating Decision\s+(?:D|d)ated[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1] ||
    (text.match(/This decision is dated[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/i) || [])[1] ||
    (text.match(/This decision is dated[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1] ||
    (text.match(/Date of Decision[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/i) || [])[1] ||
    (text.match(/Date of Decision[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1] ||
    (text.match(/Decision Date[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/i) || [])[1] ||
    (text.match(/Decision Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1] ||
    (text.match(/^([A-Z][a-z]+ \d{1,2}, \d{4})/m) || [])[1] ||
    null;

  // Extract Effective Dates - when benefits begin or change
  // There may be multiple effective dates for different changes
  const effectiveDates = [];
  const effectiveDatePatterns = [
    /(?:Your )?Effective (?:D|d)ate[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/gi,
    /Effective (?:D|d)ate[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/gi,
    /We assigned an effective date of[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/gi,
    /(?:Your )?benefits? (?:are )?effective[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/gi,
    /The effective date for this evaluation is[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/gi,
    /effective (?:of award )?[:\s]*([A-Z][a-z]+ \d{1,2}, \d{4})/gi,
    // NEW: Look for grant + date (as suggested - handles SMC and condition grants)
    /(?:is\s+)?grant(?:ed)?\s+(?:with\s+)?(?:an?\s+)?(?:evaluation|effective\s+date)[:\s]*([A-Z][a-z]+ \d{1,2}, \d{4})/gi,
    /(?:Service\s+)?[Cc]onnection.*?(?:is\s+)?grant(?:ed)?[:\s]+(?:effective\s+)?([A-Z][a-z]+ \d{1,2}, \d{4})/gi,
    // NEW: Look for dates near SMC grant language
    /(?:Special\s+)?[Mm]onthly\s+[Cc]ompensation.*?(?:effective|award)[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/gi
  ];

  for (const pattern of effectiveDatePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const dateStr = match[1];
      if (!effectiveDates.includes(dateStr)) {
        effectiveDates.push(dateStr);
      }
    }
  }

  // Get primary effective date (first one found)
  const primaryEffectiveDate = effectiveDates.length > 0 ? effectiveDates[0] : null;

  // Extract Combined Rating from decision
  const combinedRating =
    (text.match(/combined rating evaluation is (\d+)%/i) || [])[1] ||
    (text.match(/combined disability rating is (\d+)%/i) || [])[1] ||
    (text.match(/your combined disability rating is (\d+)%/i) || [])[1] ||
    (text.match(/combined evaluation is (\d+)%/i) || [])[1] ||
    null;

  return {
    veteranName: (text.match(/\b([A-Z]{2,}\s+[A-Z]\s+[A-Z]{2,})\b/) || [])[1] || null,
    fileNumber:
      (text.match(/File Number[:\s]+(\d{6,12})/i) || [])[1] ||
      (text.match(/VA File Number[:\s]+(\d{6,12})/i) || [])[1] ||
      (text.match(/Claim Number[:\s]+(\d{6,12})/i) || [])[1] ||
      null,
    ratingDecisionDate,
    effectiveDate: primaryEffectiveDate,
    allEffectiveDates: effectiveDates.length > 0 ? effectiveDates : null,
    combinedRating: combinedRating ? `${combinedRating}%` : null,
  };
}

function extractServiceConnectedFromList(textWithLines) {
  const block = extractSection(
    textWithLines,
    /\bDECISION\b/i,
    [/\bREASONS AND BASES\b/i, /\bEVIDENCE\b/i, /\bORDER\b/i]
  );
  if (!block) return [];

  const lines = block
    .split("\n")
    .map((line) => line.replace(/^\s*\d+\.?\s+/, "").replace(/^\s*[l•·-]\s+/i, "").trim())
    .filter(Boolean);

  // First pass: identify numbered items that span multiple lines
  const numberedItems = [];
  let currentItem = null;
  let currentNumber = null;
  
  block.split("\n").forEach((line) => {
    const numberMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (numberMatch) {
      // Start of a new numbered item
      if (currentItem) {
        numberedItems.push({ number: currentNumber, text: currentItem.trim() });
      }
      currentNumber = numberMatch[1];
      currentItem = numberMatch[2];
    } else if (currentItem && line.trim()) {
      // Continuation of current item
      currentItem += " " + line.trim();
    }
  });
  
  // Don't forget the last item
  if (currentItem) {
    numberedItems.push({ number: currentNumber, text: currentItem.trim() });
  }
  
  // Process numbered items that are service-connected grants
  const fromNumbered = numberedItems
    .filter(item => /service connection for/i.test(item.text) && /granted/i.test(item.text))
    .map(item => {
      const text = item.text;
      
      // Extract percentage
      const percentMatch = text.match(/(\d{1,3})\s*percent/);
      const percentage = percentMatch ? safeNumber(percentMatch[1]) : 0;
      
      // Extract condition name - everything between "for" and "is granted"
      let conditionText = "";
      const forMatch = text.match(/service connection for (.+?)(?:\s+is granted|\s+\(claimed)/i);
      if (forMatch) {
        conditionText = forMatch[1];
      }
      
      // RULE: Do NOT split on semicolons. Keep them as-is.
      // Semicolons are descriptive pathology separators, not condition separators.
      const condition = cleanCondition(conditionText
        .replace(/\s*\(claimed as.*?\)/gi, "")
        .trim());
      
      // Extract effective date
      let effectiveDate = "";
      const dateMatch = text.match(/effective\s+([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/i) ||
                        text.match(/effective\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (dateMatch) {
        effectiveDate = dateMatch[1];
      }
      
      if (!condition || condition.length < 3) return null;
      if (/\bdenied\b/i.test(condition)) return null;
      
      return {
        condition,
        rating: `${percentage}%`,
        percentage,
        effectiveDate,
        isBilateral: isBilateralCondition(condition),
        laterality: extractLaterality(condition),
        status: "granted"
      };
    })
    .filter(Boolean);
  
  // Also process single-line items (legacy support)
  const fromLines = lines
    .filter((line) => /(\d{1,3})\s*percent/i.test(line))
    .filter((line) => /service connection for|entitlement to service connection for|\bis\s+granted\b|\bwas\s+granted\b|with an evaluation of/i.test(line))
    .filter((line) => !/\bnot warranted\b|\bhigher evaluation\b|\bunless the evidence shows\b/i.test(line))
    .filter((line) => line.length < 500)
    .map((line) => {
      const percentage = safeNumber((line.match(/(\d{1,3})\s*percent/i) || [])[1]);
      
      // Clean the line more aggressively to extract just the condition name
      let conditionText = line
        .replace(/\s*-?\s*\d{1,3}\s*percent.*/i, "")  // Remove percent and everything after
        .replace(/\s*\(.*?\)/g, "")  // Remove parentheticals
        .replace(/^\s*(?:service connection for|entitlement to service connection for)\s+/i, "")  // Remove prefix
        .replace(/\s+(?:is|was)\s+(?:granted|denied|evaluated|increased|decreased|continued).*$/i, "")  // Remove sentence endings
        .replace(/\s+(?:effective|with an evaluation of).*$/i, "")  // Remove trailing phrases
        .trim();
      
      const condition = cleanCondition(conditionText);
      
      // Extract effective date - look for "effective [date]" at end of line
      let effectiveDate = "";
      const dateMatch = line.match(/effective\s+([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/i) ||
                        line.match(/effective\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (dateMatch) {
        effectiveDate = dateMatch[1];
      }
      
      if (!condition || percentage === null) return null;
      if (/\bdenied\b/i.test(condition)) return null;
      
      return {
        condition,
        rating: `${percentage}%`,
        percentage,
        effectiveDate,
        isBilateral: isBilateralCondition(condition),
        laterality: extractLaterality(condition),
        status: "granted"
      };
    })
    .filter(Boolean);
  
  // Combine both extraction methods and dedupe
  return dedupeByConditionAndRating([...fromNumbered, ...fromLines]);
}

function extractServiceConnected(text) {
  // Improved patterns with strict boundaries to prevent capturing form text
  // Use [^.●•\n]{1,200} to allow longer medical condition names but stop at sentence boundaries
  const patterns = [
    // Standard grant + evaluation + effective date
    /Service connection for ([^.●•\n]{1,200}?) is granted with an evaluation of (\d+)\s*percent/gi,
    // Grant + separate evaluation sentence
    /Service connection for ([^.●•\n]{1,200}?) is granted\.?\s*Evaluation\s*of\s*(\d+)\s*percent/gi,
    // Entitlement form
    /Entitlement to service connection for ([^.●•\n]{1,200}?) is granted\.?\s*Evaluation\s*of\s*(\d+)\s*percent/gi,
    // Granted and evaluated as
    /Service connection for ([^.●•\n]{1,200}?) is granted and evaluated as (\d+)\s*percent/gi,
    // Granted and rated at (common modern format)
    /Service connection for ([^.●•\n]{1,200}?) is granted and rated at (\d+)\s*percent/gi,
    // Increased to (appeals/reviews) - strict boundary
    /(?:Service connection for |Evaluation for )?([^.●•\n]{1,180}?) (?:is |was )?increased (?:to |from [^t]{1,30}?to )(\d+)\s*percent/gi,
    // Continued at (re-evaluations)
    /(?:Service connection for |Evaluation for )?([^.●•\n]{1,180}?) (?:is |was )?continued at (\d+)\s*percent/gi,
    // Decreased to (reductions)
    /(?:Service connection for |Evaluation for )?([^.●•\n]{1,180}?) (?:is |was )?decreased to (\d+)\s*percent/gi,
    // Assigned evaluation
    /([^.●•\n]{1,180}?) is assigned an evaluation of (\d+)\s*percent/gi,
    // Reverse format: rating first (only when tied to explicit evaluation language)
    /(?:evaluation\s+of|rated\s+at)\s*(\d+)\s*percent\s+for\s*([^.●•\n]{1,180}?)(?:\s+is\s+granted|\s+granted|\s+effective)/gi,
    // Amended/Modified rating (appeals)
    /(?:Service connection for )?([^.●•\n]{1,180}?)\s+is\s+(?:amended|modified)\s+to\s+(\d+)\s*percent/gi,
    // Reentitlement (new decisions)
    /Reentitlement\s+to\s+service\s+connection\s+for\s+([^.●•\n]{1,180}?)\s+(?:is\s+granted\s+and\s+)?rated\s+at\s+(\d+)\s*percent/gi,
    // Conceded rating (stipulated by VA)
    /Service\s+connection\s+for\s+([^.●•\n]{1,180}?)\s+is\s+conceded\s+(?:and\s+)?rated\s+at\s+(\d+)\s*percent/gi,
    // With evaluation (alternative syntax)
    /(?:Service connection for )?([^.●•\n]{1,180}?)\s+with\s+(?:an\s+)?evaluation\s+of\s+(\d+)\s*percent/gi,
    // Determined language (alternative to granted)
    /(?:Service connection for )?([^.●•\n]{1,180}?)\s+(?:is\s+)?determined\s+(?:and\s+)?rated\s+at\s+(\d+)\s*percent/gi,
    // Approved language (alternative VA phrasing)
    /(?:Service connection for )?([^.●•\n]{1,180}?)\s+(?:is\s+)?approved\s+at\s+(\d+)\s*percent/gi,
    // Restored service connection (re-rating from denied→granted)
    /Service\s+connection\s+for\s+([^.●•\n]{1,180}?)\s+(?:is\s+)?restored\s+and\s+rated\s+at\s+(\d+)\s*percent/gi,
    // Upgraded/downgraded in percent
    /([^.●•\n]{1,180}?)\s+(?:upgraded|downgraded)\s+to\s+(\d+)\s*percent/gi,
    // Percentages with condition text before "service connection"
    /([A-Z][^.!?]{1,180}?)\.?\s+Service\s+connection\s+is\s+granted\s+at\s+(\d+)\s*percent/gi,
    // Disability with enhanced evaluation
    /(?:Service connection for )?([^.●•\n]{1,180}?)\s+is\s+(?:now\s+)?evaluated\s+at\s+(\d+)\s*percent/gi,
    // NEW: Generic grant pattern for conditions (catches SMC and other grants)
    /(?:The condition of |The diagnosis of )?([^.●•\n]{1,180}?)\s+(?:is\s+)?granted(?:\s+with)?(?:\s+an?\s+)?(?:evaluation|rating)?\s*(?:of\s+)?(\d+)\s*percent/gi
  ];

  const results = [];
  patterns.forEach((pattern, index) => {
    matchAll(text, pattern).forEach((m) => {
      // Pattern at index 9 has reversed capture groups: (rating)(condition)(effectiveDate)
      const rawCondition = index === 9 ? m[2] : m[1];
      const condition = cleanCondition(rawCondition);
      const ratingValue = index === 9 ? m[1] : m[2];
      const effectiveDate = m[3] || "";
      const percentage = safeNumber(ratingValue);
      
      // Enhanced validation
      if (!condition || percentage === null) return;
      if (/\bdenied\b/i.test(rawCondition)) return;
      if (/\bdenied\b/i.test(condition)) return;
      if (isNoiseCondition(condition)) return;
      if (isNoiseCondition(rawCondition)) return; // Check raw too
      
      // Additional sanity checks
      if (condition.length > 200) return; // Too long (increased from 150)
      if (condition.split(' ').length > 35) return; // Too many words (increased from 25)
      
      results.push({
        condition,
        rating: `${percentage}%`,
        percentage,
        effectiveDate: effectiveDate.trim(),
        isBilateral: isBilateralCondition(condition),
        laterality: extractLaterality(condition),
        status: "granted",
      });
    });
  });

  return dedupeByConditionAndRating(results);
}

function extractDenied(text) {
  // Enhanced patterns for denied condition extraction (8+ patterns for comprehensive coverage)
  const patterns = [
    /Service connection for ([^.\u25cf\u2022\n]{1,200}?) is denied/gi,
    /Entitlement to service connection for ([^.\u25cf\u2022\n]{1,200}?) is denied/gi,
    // Not service connected
    /(?:Service connection for )?([^.\u25cf\u2022\n]{1,200}?)\s+(?:is\s+)?not\s+service\s+connected/gi,
    // Proposed but then denied
    /(?:Service connection for )?([^\.\u25cf\u2022\n]{1,200}?)\s+proposed\s+but\s+denied/gi
  ];

  const out = [];
  patterns.forEach((pattern) => {
    matchAll(text, pattern).forEach((m) => {
      let rawCondition = m[1];
      if (/service connection for/i.test(rawCondition)) {
        const parts = rawCondition.split(/service connection for/i).map((part) => part.trim()).filter(Boolean);
        rawCondition = parts[parts.length - 1] || rawCondition;
      }
      const condition = cleanCondition(rawCondition);
      if (!condition || isNoiseCondition(condition)) return;
      if (isNoiseCondition(rawCondition)) return;
      if (condition.length > 200) return;
      if (condition.split(' ').length > 35) return;
      out.push({
        condition,
        reason: null,
      });
    });
  });

  return dedupeByConditionAndRating(out);
}

function extractDeniedFromList(textWithLines) {
  const block = extractSection(
    textWithLines,
    /\bDECISION\b/i,
    [/\bREASONS AND BASES\b/i, /\bEVIDENCE\b/i, /\bORDER\b/i]
  );
  if (!block) return [];

  const lines = block
    .split("\n")
    .flatMap((line) => line.split(/\s+[l•·]\s+/i))
    .map((line) => line.replace(/^\s*\d+\.?\s+/, "").replace(/^\s*[l•·-]\s+/i, "").trim())
    .filter(Boolean);

  return lines
    .filter((line) => /\bservice connection\b.*\bis denied\b/i.test(line))
    .filter((line) => line.length < 240)
    .map((line) => {
      const condition = cleanCondition(line.replace(/is denied.*/i, ""));
      if (!condition || isNoiseCondition(condition)) return null;
      return { condition, reason: null };
    })
    .filter(Boolean);
}

const BENEFIT_REQUIREMENTS = {
  'DEA': {
    name: "Dependents' Educational Assistance (Chapter 35)",
    shortName: 'DEA / Chapter 35',
    requirements: [
      'Veteran has 100% permanent and total (P&T) disability rating',
      'Or veteran died from service-connected condition',
      'Or veteran is missing in action or POW',
      'Child must be age 18-26 (or age 14-26 for job training)',
      'Spouse eligible if married to veteran before Oct 1, 1981'
    ]
  },
  'CHAMPVA': {
    name: 'CHAMPVA (Civilian Health and Medical Program)',
    shortName: 'CHAMPVA',
    requirements: [
      'Veteran has 100% permanent and total (P&T) disability rating',
      'Or veteran died from service-connected disability',
      'Or veteran died on active duty',
      'Beneficiary not eligible for TRICARE',
      'Must be spouse or dependent child of eligible veteran'
    ]
  },
  'SAH/SHA': {
    name: 'Specially Adapted Housing (SAH/SHA)',
    shortName: 'SAH/SHA Grant',
    requirements: [
      'Loss or loss of use of both lower extremities',
      'Or blindness in both eyes with 5/200 visual acuity or less',
      'Or loss or loss of use of one lower extremity with residuals of organic brain condition',
      'Or certain severe burn injuries',
      'Veterans can receive up to 3 grants (SAH/SHA)'
    ]
  },
  'Automobile': {
    name: 'Automobile Allowance',
    shortName: 'Auto Allowance',
    requirements: [
      'Loss or permanent loss of use of one or both hands or feet',
      'Or permanent impairment of vision in both eyes to a certain degree',
      'Or ankylosis (immobility) of one or both knees or hips',
      'One-time payment for vehicle purchase',
      'May also qualify for adaptive equipment grant'
    ]
  },
  'Clothing': {
    name: 'Clothing Allowance',
    shortName: 'Clothing Allowance',
    requirements: [
      'Service-connected skin condition requiring prescribed medication that damages clothing',
      'Or uses prosthetic or orthopedic device that damages clothing',
      'Or uses medication for service-connected skin condition that stains garments',
      'Annual payment (can be received yearly if eligible)'
    ]
  },
  'VR&E': {
    name: 'Vocational Rehabilitation & Employment (Chapter 31)',
    shortName: 'VR&E / Chapter 31',
    requirements: [
      'Have at least 10% service-connected disability rating',
      'And have an employment handicap (disability limits ability to work)',
      'Or have at least 20% service-connected disability rating',
      'And have a serious employment handicap',
      'Must be within 12 years of separation or notification of rating (extensions possible)'
    ]
  },
  'Caregiver': {
    name: 'Program of Comprehensive Assistance for Family Caregivers',
    shortName: 'Caregiver Support',
    requirements: [
      'Veteran incurred or aggravated serious injury in line of duty on or after Sept 11, 2001',
      'Or incurred/aggravated serious injury before Sept 11, 2001',
      'Veteran needs assistance with activities of daily living',
      'Caregiver must be approved by VA',
      'Provides stipend, training, mental health services, and respite care'
    ]
  }
};

/**
 * Extract ancillary benefits using 38 CFR Part 3 and M21-1 rules
 * Detects: DEA, CHAMPVA, Clothing, Auto, SAH/SHA, A&A, Housebound, etc.
 */
function extractAncillary(text) {
  // Extract service-connected conditions and metadata for eligibility rules
  const metadata = extractMetadata(text);
  const serviceConnected = [];
  
  // Quick extraction of conditions for ancillary benefits detection
  // (This runs before full scan, so we do lightweight extraction)
  const scMatches = text.matchAll(/service connection for\s+([^.\n]{1,150}?)\s+(?:is|was)\s+granted/gi);
  for (const match of scMatches) {
    const condition = match[1].trim();
    const percentMatch = text.slice(match.index, match.index + 300).match(/(\d{1,3})\s*percent/);
    const percentage = percentMatch ? parseInt(percentMatch[1]) : 0;
    serviceConnected.push({ condition, percentage });
  }
  
  // Use comprehensive CFR-aware detector
  const detected = detectAncillaryBenefits(serviceConnected, metadata, text);
  
  // Keep legacy format compatibility while adding new data
  const legacyFormat = detected
    .filter(b => b.status === 'eligible' || b.status === 'inferred eligible')
    .map(b => ({
      benefit: b.benefit,
      shortName: b.benefit.split('(')[0].trim(),
      status: b.status === 'eligible' ? 'Granted' : 'Inferred Eligible',
      requirements: [b.reason],
      inRating: b.status === 'eligible',
      cfr: b.cfr,
      evidence: b.evidence,
      note: b.note
    }));
  
  // Return enhanced format with both legacy and new CFR-aware data
  return [
    ...legacyFormat,
    ...detected
      .filter(b => b.status !== 'eligible' && b.status !== 'inferred eligible')
      .map(b => ({
        benefit: b.benefit,
        shortName: b.benefit.split('(')[0].trim(),
        status: 'Not Detected',
        requirements: [],
        inRating: false,
        detectionDetails: b
      }))
  ];
}

function extractSMCLevelFromReason(reason) {
  if (!reason) return null;
  
  const reasonLower = reason.toLowerCase();
  
  // Map common reasons to SMC levels
  if (reasonLower.includes('housebound')) return 'SMC-S (Housebound)';
  if (reasonLower.includes('aid and attendance') || reasonLower.includes('a&a')) return 'SMC-L (Aid and Attendance)';
  if (reasonLower.includes('loss of use') && (reasonLower.includes('extremity') || reasonLower.includes('limb'))) return 'SMC-K (Loss of Use)';
  if (reasonLower.includes('loss of creative organ') || reasonLower.includes('erectile dysfunction')) return 'SMC-K (Loss of Creative Organ)';
  if (reasonLower.includes('blindness') || reasonLower.includes('loss of eye')) return 'SMC-L+ (Anatomical Loss/Blindness)';
  
  // Check for specific SMC code in the reason
  const smcMatch = reason.match(/SMC[-\s]?([KLMNOPQRST][1-9]?)\b/i);
  if (smcMatch) return `SMC-${smcMatch[1].toUpperCase()}`;
  
  return null;
}

/**
 * Extract SMC using 38 CFR 3.350 and M21-1 rules
 * Detects all SMC levels: K, L, L½, M, M½, N, O, R1, R2, S, T
 * 
 * CRITICAL: Only include SMC that is EXPLICITLY GRANTED, not merely eligible
 */
function extractSMC(serviceConnected, text) {
  const metadata = extractMetadata(text);

  const hasLocalGrantContext = (context) => {
    return /\b(?:is|was)?\s*(?:granted|awarded|established)\b|\bentitled\s+to\b|\baward(?:ed)?\b/i.test(context);
  };

  const hasLocalDeniedContext = (context) => {
    return /\bdenied?\b|not\s+granted|lack\s+evidence|insufficient|no\s+entitle|rejected|not\s+award/i.test(context);
  };

  const looksLikeLegendOrDefinition = (context) => {
    const normalized = String(context || '');
    const shortCodeDefinitions = normalized.match(/(?:^|[,;\s])(R1|R2|L½|M½|N½|[KLMNOST])\s*[-:]/gi) || [];
    const smcMentions = normalized.match(/\bSMC[- ]?(R1|R2|L½|M½|N½|[KLMNOST])\b/gi) || [];
    return shortCodeDefinitions.length >= 2 || smcMentions.length >= 3;
  };
  
  // STRICT: Only extract explicitly mentioned SMC with grant context
  // Do NOT use detectSMC for conditions matching patterns - that detects eligibility, not grants
  const smcLevels = ['K', 'L', 'L½', 'M', 'M½', 'N', 'O', 'R1', 'R2', 'S', 'T'];
  const grantedSMC = [];
  
  for (const level of smcLevels) {
    // Look ONLY for explicit "SMC-X" or "SMC X" text in document
    const smcPattern = new RegExp(`\\bSMC[- ]?${level.replace('½', '½')}\\b`, 'gi');
    let match;
    let hasGrantedMention = false;
    
    while ((match = smcPattern.exec(text)) !== null) {
      const localContextStart = Math.max(0, match.index - 90);
      const localContextEnd = Math.min(text.length, match.index + 90);
      const localContext = text.substring(localContextStart, localContextEnd);

      const broaderContextStart = Math.max(0, match.index - 220);
      const broaderContextEnd = Math.min(text.length, match.index + 220);
      const broaderContext = text.substring(broaderContextStart, broaderContextEnd);
      
      // STRICT grant context check - must have explicit grant keywords
      const hasGrantedContext = hasLocalGrantContext(localContext);
      const isDenied = hasLocalDeniedContext(localContext);
      const isLegend = looksLikeLegendOrDefinition(broaderContext);
      
      // Only count if EXPLICITLY GRANTED and NOT DENIED
      if (hasGrantedContext && !isDenied && !isLegend) {
        hasGrantedMention = true;
        break;
      }
    }
    
    if (hasGrantedMention) {
      // Create SMC entry for granted level
      const smcRules = {
        'K': 'Erectile dysfunction',
        'L': 'Loss or loss of use of hand',
        'L½': 'Two or more SMC-L level disabilities',
        'M': 'Loss of hand and foot',
        'M½': 'Two or more SMC-M level disabilities',
        'N': 'Blindness + A&A',
        'O': 'Explicitly stated as SMC-O',
        'R1': 'Explicitly stated as SMC-R1',
        'R2': 'Explicitly stated as SMC-R2',
        'S': 'Explicitly stated as SMC-S',
        'T': 'Explicitly stated as SMC-T'
      };
      
      grantedSMC.push({
        level,
        reason: smcRules[level] || `Explicitly stated as SMC-${level}`,
        cfr: '38 CFR 3.350',
        evidence: 'Explicit SMC mention with grant context'
      });
    }
  }
  
  // Legacy format compatibility - only include actually granted SMC (no inferred)
  const explicit = grantedSMC.map(smc => `${smc.level} - ${smc.reason}`);
  const inferredLegacy = []; // Do NOT include inferred SMC
  const eligibilityIndicators = [];
  
  // Add eligibility indicators (NOT the same as granted SMC)
  if (/aid and attendance|a&a/i.test(text)) {
    eligibilityIndicators.push('Aid and Attendance referenced');
  }
  if (/housebound/i.test(text)) {
    eligibilityIndicators.push('Housebound referenced');
  }
  if (/loss of use|anatomical loss/i.test(text)) {
    eligibilityIndicators.push('Loss of use referenced');
  }
  if (/blindness|visual impairment/i.test(text)) {
    eligibilityIndicators.push('Vision impairment referenced');
  }
  
  return {
    // Legacy fields - only granted SMC
    smcK: grantedSMC.some(s => s.level === 'K'),
    explicit,
    inferred: inferredLegacy,
    eligibilityIndicators,
    
    // New CFR-aware fields - only granted (no inferred)
    detectedLevels: grantedSMC,
    inferredLevels: [],
    allLevels: grantedSMC,
    
    // Assessment with granted levels only
    assessment: {
      smcK: grantedSMC.some(s => s.level === 'K'),
      smcL: grantedSMC.some(s => s.level === 'L'),
      smcS: grantedSMC.some(s => s.level === 'S'),
      hasAnySMC: grantedSMC.length > 0
    }
  };
}

function extractDependents(text) {
  const patterns = [
    /(Child|Spouse)\s+([A-Za-z\s]+?)\s+effective\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/gi,
    /(Child|Spouse)\s+([A-Za-z\s]+?)\s+added\s+to\s+your\s+award\s+effective\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/gi
  ];

  const out = [];
  patterns.forEach((pattern) => {
    matchAll(text, pattern).forEach((m) => {
      out.push({
        type: m[1].trim(),
        name: m[2].trim(),
        effectiveDate: m[3].trim(),
      });
    });
  });

  return out;
}

function extractPayments(text) {
  const pattern =
    /(\$\d[\d,\.]+)\s+(\$\d[\d,\.]+)\s+(\$\d[\d,\.]+)\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})\s+([A-Za-z\s]+)/gi;
  const out = matchAll(text, pattern).map((m) => ({
    totalBenefit: m[1],
    withheld: m[2],
    paid: m[3],
    startDate: m[4],
    reason: m[5].trim(),
  }));

  const altPattern =
    /monthly\s+entitlement\s+is\s+(\$\d[\d,\.]+)/gi;
  matchAll(text, altPattern).forEach((m) => {
    out.push({
      totalBenefit: m[1],
      withheld: null,
      paid: null,
      startDate: null,
      reason: "Monthly entitlement",
    });
  });

  return out;
}

function extractEvidence(text) {
  const block = extractSection(
    text,
    /Evidence Considered/i,
    [/Please Take Action/i, /Reasons and Bases/i, /Decision/i, /Conclusion/i]
  );
  if (!block) return [];
  return block
    .split(/\n|\.|;/)
    .map((x) => x.trim())
    .filter((x) => x.length > 5)
    .map((item) => item.replace(/^[-•]\s+/, ""));
}

function classifyEvidence(items) {
  const byType = {};
  const add = (type, item) => {
    if (!byType[type]) byType[type] = [];
    byType[type].push(item);
  };

  items.forEach((item) => {
    const lower = item.toLowerCase();
    if (/c&p|compensation and pension|va examination/i.test(item)) {
      add("VA Examination", item);
    } else if (/service treatment|service medical|str/i.test(item)) {
      add("Service Records", item);
    } else if (/private medical|private treatment|physician/i.test(item)) {
      add("Private Medical", item);
    } else if (/lay statement|buddy statement|statement in support/i.test(item)) {
      add("Lay Statement", item);
    } else if (/va treatment|vha|clinic|hospital/i.test(item)) {
      add("VA Treatment", item);
    } else {
      add("Other", item);
    }
  });

  return byType;
}

function extractDenialReasons(textWithLines, denied) {
  const reasonsBlock = extractSection(
    textWithLines,
    /Reasons and Bases/i,
    [/Decision/i, /Conclusion/i, /Order/i, /Please Take Action/i]
  );
  if (!reasonsBlock || !denied.length) return denied;

  const lines = reasonsBlock
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const enriched = denied.map((item) => ({ ...item }));

  enriched.forEach((item) => {
    const key = normalizeConditionKey(item.condition);
    if (!key) return;
    const match = lines.find((line) => normalizeConditionKey(line).includes(key));
    if (match) {
      const reasonSentence =
        (match.match(/(denied\s+(?:because|due to|since|as)[^.!?]*[.!?])/i) || [])[1] ||
        (match.match(/(is\s+denied[^.!?]*[.!?])/i) || [])[1] ||
        match;
      item.reason = reasonSentence.trim() || item.reason;
    }
  });

  return enriched;
}

function findDeniedReasonSentence(text, condition) {
  if (!text || !condition) return null;
  const conditionKey = normalizeConditionKey(condition);
  if (!conditionKey) return null;

  const tokens = conditionKey.split(" ").filter((token) => token.length > 2);
  const normalizedText = text.replace(/\s+/g, " ");
  const sentences =
    normalizedText.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()) ||
    normalizedText.split(/[.!?]\s+/).map((sentence) => sentence.trim());

  let fallbackSentence = null;

  for (const sentence of sentences) {
    if (!/denied/i.test(sentence)) continue;
    const normalizedSentence = normalizeConditionKey(sentence);
    if (!tokens.every((token) => normalizedSentence.includes(token))) continue;
    const deniedBecause = (sentence.match(/(denied\s+(?:because|due to|since|as)[^.!?]*[.!?])/i) || [])[1];
    if (deniedBecause) return deniedBecause.trim();
    const deniedShort = (sentence.match(/(is\s+denied[^.!?]*[.!?])/i) || [])[1];
    fallbackSentence = deniedShort ? deniedShort.trim() : sentence;
  }

  if (fallbackSentence) return fallbackSentence;

  const fallbackPattern = new RegExp(
    `${escapeRegex(condition)}\\s+(?:is|was|remains)?\\s*denied\\s+(?:because|due to|since|as)\\s+[^.!?]*[.!?]`,
    "i"
  );
  const fallback = text.match(fallbackPattern);
  return fallback ? fallback[0].trim() : null;
}

function extractDecisionItems(textWithLines) {
  const decisionBlock = extractSection(
    textWithLines,
    /\bDECISION\b/i,
    [/\bREASONS AND BASES\b/i, /\bEVIDENCE\b/i, /\bORDER\b/i]
  );
  if (!decisionBlock) return { serviceConnected: [], denied: [] };

  const lines = decisionBlock
    .split("\n")
    .flatMap((line) => line.split(/\s+[l•·]\s+/i))
    .map((line) => line.replace(/^\s*\d+\.?\s+/, "").trim())
    .filter(Boolean);

  const serviceConnected = [];
  const denied = [];

  lines.forEach((line) => {
    if (/service connection.*granted/i.test(line) || /is\s+granted/i.test(line)) {
      const conditionMatch = line.match(/service connection for (.+?) is granted/i);
      const condition = cleanCondition(conditionMatch?.[1] || line.replace(/is granted.*/i, ""));
      const percentage = safeNumber((line.match(/(\d{1,3})\s*percent/i) || [])[1]);
      if (condition && percentage !== null) {
        serviceConnected.push({
          condition,
          rating: `${percentage}%`,
          percentage,
          effectiveDate: (line.match(/effective\s+([^\.]+)$/i) || [])[1]?.trim() || "",
          isBilateral: isBilateralCondition(condition),
          laterality: extractLaterality(condition),
          status: "granted"
        });
      }
    }

    if (/service connection.*denied/i.test(line) || /is\s+denied/i.test(line)) {
      const conditionMatch = line.match(/service connection for (.+?) is denied/i);
      const condition = cleanCondition(conditionMatch?.[1] || line.replace(/is denied.*/i, ""));
      if (condition) {
        denied.push({ condition, reason: null });
      }
    }
  });

  return {
    serviceConnected: dedupeByConditionAndRating(serviceConnected),
    denied: dedupeByConditionAndRating(denied)
  };
}

const presumptiveLocations = [
  "Karshi-Khanabad",
  "K2",
  "Uzbekistan",
  "Iraq",
  "Afghanistan",
  "Camp Lejeune",
  "Southwest Asia",
  "Gulf War"
];
const combatAwards = [
  "Combat Infantryman Badge",
  "CIB",
  "Purple Heart",
  "CAR",
  "Combat Action Ribbon",
  "Combat Action Badge"
];

function inferPresumptives(text) {
  const lower = text.toLowerCase();
  const locHit = presumptiveLocations.some((loc) =>
    lower.includes(loc.toLowerCase())
  );
  return {
    presumptiveEligible: locHit,
    burnPitPresumption: locHit || /burn pit|airborne hazards/i.test(text),
    combatPresumption: combatAwards.some((a) =>
      lower.includes(a.toLowerCase())
    ),
  };
}

function inferAwardEntitlements(text) {
  const lower = text.toLowerCase();
  const out = [];
  if (combatAwards.some((a) => lower.includes(a.toLowerCase())))
    out.push("Combat presumption for PTSD / mental health / injuries");
  if (lower.includes("individual unemployability") || lower.includes("tdiu"))
    out.push("TDIU / unemployability entitlement present or implied");
  return out;
}

function extractConditionContextLine(textWithLines, condition) {
  if (!textWithLines || !condition) return "";

  const conditionKey = normalizeConditionKey(condition);
  if (!conditionKey) return "";
  const tokens = conditionKey.split(" ").filter((token) => token.length > 2);

  const lines = textWithLines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length > 10);

  let bestLine = "";
  let bestScore = 0;

  lines.forEach((line) => {
    const normalizedLine = normalizeConditionKey(line);
    if (!normalizedLine) return;

    let score = 0;
    tokens.forEach((token) => {
      if (normalizedLine.includes(token)) score += 1;
    });

    if (/service\s+connection|evaluation|rated|effective|granted|denied|increased|decreased|continued/i.test(line)) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestLine = line;
    }
  });

  return bestScore >= 2 ? bestLine : "";
}

function extractConditionEffectiveDate(condition, textWithLines) {
  const contextLine = extractConditionContextLine(textWithLines, condition);
  if (!contextLine) return "";

  const dateMatch =
    contextLine.match(/effective\s+(?:date\s+)?(?:of\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i) ||
    contextLine.match(/effective\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
    contextLine.match(/from\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i) ||
    contextLine.match(/from\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);

  return dateMatch?.[1]?.trim() || "";
}

function detectRatingChange(condition, currentPercentage, textWithLines) {
  const contextLine = extractConditionContextLine(textWithLines, condition);
  const current = Number.isFinite(currentPercentage) ? currentPercentage : null;

  if (!contextLine) {
    return {
      type: "unknown",
      previousPercentage: null,
      currentPercentage: current,
      evidence: ""
    };
  }

  let type = "new";
  let previousPercentage = null;

  if (/\b(?:increased|raise[sd]?|upgraded)\b/i.test(contextLine)) {
    type = "increase";
  } else if (/\b(?:decreased|reduced|downgraded)\b/i.test(contextLine)) {
    type = "decrease";
  } else if (/\b(?:continued|confirmed|maintained)\b/i.test(contextLine)) {
    type = "continued";
  } else if (/\b(?:restored|reentitlement)\b/i.test(contextLine)) {
    type = "restored";
  } else if (/\b(?:granted|service\s+connection\s+for)\b/i.test(contextLine)) {
    type = "new";
  }

  const fromToMatch = contextLine.match(/from\s+(\d{1,3})\s*(?:%|percent)\s+to\s+(\d{1,3})\s*(?:%|percent)/i);
  if (fromToMatch) {
    previousPercentage = safeNumber(fromToMatch[1]);
    if (current === null) {
      const currentFromText = safeNumber(fromToMatch[2]);
      if (Number.isFinite(currentFromText)) {
        return {
          type,
          previousPercentage,
          currentPercentage: currentFromText,
          evidence: contextLine
        };
      }
    }
  } else {
    const priorMatch = contextLine.match(/previous(?:ly)?\s+(?:rated|evaluated)?\s*(?:at|as)?\s*(\d{1,3})\s*(?:%|percent)/i);
    if (priorMatch) {
      previousPercentage = safeNumber(priorMatch[1]);
    }
  }

  return {
    type,
    previousPercentage,
    currentPercentage: current,
    evidence: contextLine
  };
}

function detectPotentialPyramiding(serviceConnected) {
  const grouped = new Map();

  serviceConnected.forEach((item) => {
    const cfr = normalizeToCFRTerminology(item.condition || "");
    const anatomyKey = cfr?.anatomy ? String(cfr.anatomy).toLowerCase() : "unknown";
    const lateralityKey = item?.laterality || "none";
    const key = `${anatomyKey}|${lateralityKey}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push({ item, cfr });
  });

  const findings = [];

  for (const [key, entries] of grouped.entries()) {
    if (entries.length < 2) continue;

    const uniqueConditions = new Set(entries.map((entry) => normalizeConditionKey(entry.item.condition)));
    if (uniqueConditions.size < 2) continue;

    const [anatomy, laterality] = key.split("|");
    findings.push({
      anatomy,
      laterality,
      severity: "review",
      cfr: "38 CFR 4.14",
      rationale: "Multiple separately rated conditions share anatomy/laterality and may overlap manifestations.",
      conditions: entries.map((entry) => ({
        condition: entry.item.condition,
        percentage: entry.item.percentage,
        dc: entry.cfr?.dc || null
      }))
    });
  }

  return findings;
}

function extractHouseboundStatus(text, ancillaryBenefits, smc) {
  const lower = String(text || "").toLowerCase();
  const ancillaryBlob = JSON.stringify(ancillaryBenefits || []).toLowerCase();
  const smcBlob = JSON.stringify(smc || {}).toLowerCase();

  const mentioned = lower.includes("housebound") || ancillaryBlob.includes("housebound") || smcBlob.includes("housebound");
  const granted =
    /housebound[^.]{0,100}(granted|awarded|entitled)/i.test(text) ||
    /smc[-\s]?s/i.test(text) ||
    /housebound\s+rate/i.test(text);
  const denied = /housebound[^.]{0,100}denied/i.test(text);

  const evidence = (text.match(/[^.!?]*housebound[^.!?]*[.!?]?/i) || [""])[0].trim();

  return {
    mentioned,
    granted: Boolean(granted && !denied),
    denied: Boolean(denied),
    smcSInferred: /smc[-\s]?s/i.test(text),
    evidence
  };
}

function scanVaDecision(rawText) {
  const start = Date.now();
  const text = normalizeText(rawText);
  const textWithLines = normalizeTextWithLines(rawText);

  const claimantInfo = extractClaimantInfo(textWithLines || text);
  const tdiu = extractTDIU(textWithLines || text);
  const combatStatus = extractCombatStatus(textWithLines || text);

  const baseMetadata = extractMetadata(text);
  const metadata = {
    ...baseMetadata,
    veteranName: baseMetadata.veteranName || claimantInfo.claimantName || null,
    fileNumber: baseMetadata.fileNumber || claimantInfo.fileNumber || null,
    regionalOffice: claimantInfo.regionalOffice || null,
    serviceBranch: combatStatus.serviceBranch || null,
    serviceStartDate: combatStatus.serviceStartDate || null,
    serviceEndDate: combatStatus.serviceEndDate || null
  };
  const baseServiceConnected = extractServiceConnected(text);
  const baseDenied = extractDenied(text);
  const decisionItems = extractDecisionItems(textWithLines);
  const listServiceConnected = extractServiceConnectedFromList(textWithLines);
  const listDenied = extractDeniedFromList(textWithLines);
  let serviceConnected = dedupeByConditionAndRating([
    ...baseServiceConnected,
    ...decisionItems.serviceConnected
    ,...listServiceConnected
  ])
    .filter((item) => Number.isFinite(item.percentage) && item.percentage >= 0)
    .filter((item) => !/\bdenied\b/i.test(item.condition));
  
  // Detect bilateral pairs per 38 CFR 4.25/4.26
  // Group conditions by body part, ignoring laterality
  const bilateralPairs = {};
  const baseCond = (cond) => {
    const bodyPart = extractBilateralBodyPart(cond);
    if (bodyPart) return bodyPart;
    return cond.toLowerCase()
      .replace(/\b(left|right|dominant|non-dominant|side|bilateral)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  // First pass: identify all potentially bilateral conditions
  serviceConnected.forEach((item, idx) => {
    if (item.isBilateral || item.laterality) {
      const base = baseCond(item.condition);
      if (!bilateralPairs[base]) {
        bilateralPairs[base] = [];
      }
      bilateralPairs[base].push({
        idx,
        item,
        laterality: item.laterality
      });
    }
  });
  
  // Second pass: mark conditions that have matching pairs
  const validBilateralPairs = {};
  Object.keys(bilateralPairs).forEach(base => {
    const group = bilateralPairs[base];
    const compensableGroup = group.filter(g => isCompensableRating(g.item.percentage));
    const hasCompensableLeft = compensableGroup.some(g => g.laterality === 'left');
    const hasCompensableRight = compensableGroup.some(g => g.laterality === 'right');

    if (compensableGroup.length >= 2 && hasCompensableLeft && hasCompensableRight) {
      validBilateralPairs[base] = group;
    }
  });
  
  // Mark bilateral pairs in the result
  serviceConnected = serviceConnected.map((item, idx) => {
    const base = baseCond(item.condition);
    const pairGroup = validBilateralPairs[base];
    const hasPair = pairGroup && pairGroup.length >= 2;
    
    return {
      ...item,
      isBilateral: item.isBilateral || hasPair,
      bilateralPair: hasPair ? base : null,
      laterality: item.laterality || null
    };
  });
  
  let denied = dedupeByConditionAndRating([
    ...baseDenied,
    ...decisionItems.denied,
    ...listDenied
  ]);

  const explicitDeniedKeys = new Set();
  matchAll(text, /(?:service connection for|entitlement to service connection for)\s+([^.\u25cf\u2022\n]{1,200}?)\s+is\s+denied/gi)
    .forEach((match) => {
      const key = normalizeConditionKey(match[1]);
      if (key) explicitDeniedKeys.add(key);
    });

  if (explicitDeniedKeys.size > 0) {
    serviceConnected = serviceConnected.filter((item) => {
      const key = normalizeConditionKey(item.condition);
      return !explicitDeniedKeys.has(key);
    });
  }

  denied = extractDenialReasons(textWithLines, denied);
  denied = denied.map((item) => {
    if (item.reason) return item;
    const sentence = findDeniedReasonSentence(text, item.condition);
    return { ...item, reason: sentence || item.reason };
  });
  const ancillaryBenefits = extractAncillary(text);
  const smc = extractSMC(serviceConnected, text);
  const housebound = extractHouseboundStatus(textWithLines || text, ancillaryBenefits, smc);
  const dependents = extractDependents(text);
  const payments = extractPayments(text);
  const evidence = extractEvidence(textWithLines);
  const evidenceByType = classifyEvidence(evidence);

  const serviceConnectionTypeCounts = {};

  serviceConnected = serviceConnected.map((item) => {
    const cfrClassification = normalizeToCFRTerminology(item.condition || "");
    const serviceConnectionTypes = detectServiceConnectionType(item.condition || "", textWithLines || text);
    serviceConnectionTypes.forEach((entry) => {
      serviceConnectionTypeCounts[entry.type] = (serviceConnectionTypeCounts[entry.type] || 0) + 1;
    });

    const conditionEffectiveDate = item.effectiveDate || extractConditionEffectiveDate(item.condition, textWithLines || text);
    const ratingChange = detectRatingChange(item.condition, item.percentage, textWithLines || text);

    return {
      ...item,
      effectiveDate: conditionEffectiveDate || metadata.effectiveDate || "",
      serviceConnectionTypes,
      cfrClassification,
      ratingChange
    };
  });

  const bilateralApplicability = checkBilateralApplicability(serviceConnected);
  const pyramidingRisk = detectPotentialPyramiding(serviceConnected);

  const legacyPresumptiveFlags = inferPresumptives(text);
  const presumptiveFlags = {
    presumptiveEligible: Boolean(legacyPresumptiveFlags.presumptiveEligible || combatStatus.presumptiveEligible),
    burnPitPresumption: Boolean(
      legacyPresumptiveFlags.burnPitPresumption ||
      combatStatus.presumptiveCategories.includes('PACT Act / Burn Pit')
    ),
    combatPresumption: Boolean(
      legacyPresumptiveFlags.combatPresumption ||
      combatStatus.crscEligible ||
      (combatStatus.combatAwards || []).length > 0
    )
  };

  const awardEntitlements = [
    ...inferAwardEntitlements(text),
    ...(combatStatus.crscEligible ? ['Potential CRSC eligibility based on combat indicators'] : []),
    ...(tdiu.isGranted ? ['TDIU appears granted; veteran may be paid at the 100% rate'] : [])
  ].filter((value, index, arr) => arr.indexOf(value) === index);
  
  // Calculate combined rating per 38 CFR §4.25 and §4.26
  const ratings = serviceConnected.map(c => c.percentage).filter(r => r > 0);
  const bilateralCalculation = calculateWithBilateralFactor(serviceConnected);
  const extractedCombined = metadata.combinedRating ? parseInt(metadata.combinedRating) : null;
  
  // Use bilateral-adjusted rating if bilateral pairs exist, otherwise regular combined
  const calculatedCombinedRating = bilateralCalculation.hasBilateralPairs 
    ? bilateralCalculation.bilateralAdjustedCombined 
    : bilateralCalculation.regularCombined;

  return {
    scannerVersion: SCANNER_VERSION,
    metadata,
    serviceConnected,
    denied,
    ancillaryBenefits,
    smc,
    dependents,
    payments,
    evidence,
    evidenceByType,
    claimantInfo,
    combatStatus,
    tdiu,
    housebound,
    presumptiveFlags,
    awardEntitlements,
    compliance: {
      serviceConnectionTypeCounts,
      bilateralApplicability,
      pyramidingRisk
    },
    ratingCalculation: {
      // All individual ratings
      conditions: ratings,
      
      // Final calculated rating (with bilateral if applicable)
      calculatedCombinedRating,
      
      // Rating extracted from decision text (may differ from calculated)
      extractedCombinedRating: extractedCombined,
      
      // Bilateral factor details per 38 CFR §4.26
      hasBilateralPairs: bilateralCalculation.hasBilateralPairs,
      bilateralPairs: bilateralCalculation.bilateralPairs,
      regularCombined: bilateralCalculation.regularCombined,
      bilateralAdjustedCombined: bilateralCalculation.bilateralAdjustedCombined,
      bilateralBonus: bilateralCalculation.bilateralBonus,
      
      // Compliance note
      calculationMethod: bilateralCalculation.hasBilateralPairs 
        ? "38 CFR §4.25 + §4.26 (with bilateral factor)" 
        : "38 CFR §4.25 (standard combined ratings)",
      
      // Show calculation steps for transparency
      calculationSteps: generateCalculationSteps(serviceConnected, bilateralCalculation)
    },
    extractionSummary: {
      totalServiceConnected: serviceConnected.length,
      totalDenied: denied.length,
      totalAncillary: ancillaryBenefits.length,
      totalDependents: dependents.length,
      totalPayments: payments.length,
      totalEvidence: evidence.length,
      totalTDIUIndicators: tdiu.isGranted || tdiu.unemployabilityReason ? 1 : 0,
      totalCombatAwards: (combatStatus.combatAwards || []).length,
      totalPyramidingRisks: pyramidingRisk.length,
      totalHouseboundIndicators: housebound.mentioned ? 1 : 0,
      totalItems:
        serviceConnected.length +
        denied.length +
        ancillaryBenefits.length +
        dependents.length +
        payments.length +
        evidence.length +
        (tdiu.isGranted || tdiu.unemployabilityReason ? 1 : 0) +
        (housebound.mentioned ? 1 : 0),
      executionTime: Date.now() - start,
      extractedAt: new Date().toISOString(),
      evidenceByTypeCount: Object.keys(evidenceByType).length
    },
  };
}

export { scanVaDecision, looksLikeRatingDecisionNarrative };

