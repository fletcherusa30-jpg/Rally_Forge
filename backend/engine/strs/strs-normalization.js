/**
 * STRS Scanner - Medical Term Normalization Module
 * Abbreviation Expansion • Deduplication • Standardization
 * 
 * @module strs-normalization
 * @version 2.0.0
 */

// ═══════════════════════════════════════════════════════════════
// MEDICAL ABBREVIATIONS DICTIONARY
// ═══════════════════════════════════════════════════════════════

export const MEDICAL_ABBREVIATIONS = {
  // Mental Health
  'PTSD': {
    standard: 'PTSD',
    canonical: 'Posttraumatic Stress Disorder',
    variants: [
      'posttraumatic stress disorder',
      'post-traumatic stress disorder',
      'post traumatic stress',
      'combat stress',
      'operational stress',
      'PTSD'
    ],
    icd10: 'F43.1'
  },
  
  'MDD': {
    standard: 'MDD',
    canonical: 'Major Depressive Disorder',
    variants: [
      'major depressive disorder',
      'major depression',
      'clinical depression',
      'depressive disorder',
      'MDD'
    ],
    icd10: 'F33.9'
  },
  
  'GAD': {
    standard: 'GAD',
    canonical: 'Generalized Anxiety Disorder',
    variants: [
      'generalized anxiety disorder',
      'anxiety disorder',
      'chronic anxiety',
      'GAD'
    ],
    icd10: 'F41.1'
  },
  
  // Neurological
  'TBI': {
    standard: 'TBI',
    canonical: 'Traumatic Brain Injury',
    variants: [
      'traumatic brain injury',
      'brain injury',
      'concussion',
      'closed head injury',
      'CHI',
      'TBI',
      'mTBI',
      'mild traumatic brain injury'
    ],
    icd10: 'S06.9'
  },
  
  // Respiratory
  'OSA': {
    standard: 'OSA',
    canonical: 'Obstructive Sleep Apnea',
    variants: [
      'obstructive sleep apnea',
      'sleep apnea',
      'OSA',
      'sleep-disordered breathing'
    ],
    icd10: 'G47.33'
  },
  
  'COPD': {
    standard: 'COPD',
    canonical: 'Chronic Obstructive Pulmonary Disease',
    variants: [
      'chronic obstructive pulmonary disease',
      'COPD',
      'emphysema',
      'chronic bronchitis',
      'obstructive lung disease'
    ],
    icd10: 'J44.9'
  },
  
  // Gastrointestinal
  'GERD': {
    standard: 'GERD',
    canonical: 'Gastroesophageal Reflux Disease',
    variants: [
      'gastroesophageal reflux disease',
      'GERD',
      'acid reflux',
      'reflux disease',
      'esophageal reflux'
    ],
    icd10: 'K21.9'
  },
  
  'IBS': {
    standard: 'IBS',
    canonical: 'Irritable Bowel Syndrome',
    variants: [
      'irritable bowel syndrome',
      'IBS',
      'spastic colon',
      'functional bowel disorder'
    ],
    icd10: 'K58.9'
  },
  
  // Cardiovascular
  'HTN': {
    standard: 'HTN',
    canonical: 'Hypertension',
    variants: [
      'hypertension',
      'high blood pressure',
      'HTN',
      'elevated BP',
      'essential hypertension'
    ],
    icd10: 'I10'
  },
  
  'CAD': {
    standard: 'CAD',
    canonical: 'Coronary Artery Disease',
    variants: [
      'coronary artery disease',
      'CAD',
      'ischemic heart disease',
      'CHD',
      'coronary heart disease',
      'atherosclerotic heart disease'
    ],
    icd10: 'I25.10'
  },
  
  'CHF': {
    standard: 'CHF',
    canonical: 'Congestive Heart Failure',
    variants: [
      'congestive heart failure',
      'CHF',
      'heart failure',
      'cardiac failure',
      'HF'
    ],
    icd10: 'I50.9'
  },
  
  // Endocrine/Metabolic
  'DM': {
    standard: 'DM',
    canonical: 'Diabetes Mellitus',
    variants: [
      'diabetes mellitus',
      'diabetes',
      'type 2 diabetes',
      'DM',
      'DM2',
      'T2D',
      'T2DM',
      'NIDDM',
      'non-insulin dependent diabetes'
    ],
    icd10: 'E11.9'
  },
  
  'T1DM': {
    standard: 'T1DM',
    canonical: 'Type 1 Diabetes Mellitus',
    variants: [
      'type 1 diabetes',
      'T1DM',
      'T1D',
      'IDDM',
      'insulin dependent diabetes',
      'juvenile diabetes'
    ],
    icd10: 'E10.9'
  },
  
  // Musculoskeletal
  'OA': {
    standard: 'OA',
    canonical: 'Osteoarthritis',
    variants: [
      'osteoarthritis',
      'degenerative joint disease',
      'DJD',
      'OA',
      'arthrosis'
    ],
    icd10: 'M19.90'
  },
  
  'RA': {
    standard: 'RA',
    canonical: 'Rheumatoid Arthritis',
    variants: [
      'rheumatoid arthritis',
      'RA',
      'inflammatory arthritis'
    ],
    icd10: 'M06.9'
  },
  
  'DDD': {
    standard: 'DDD',
    canonical: 'Degenerative Disc Disease',
    variants: [
      'degenerative disc disease',
      'degenerative disk disease',
      'DDD',
      'spinal degeneration',
      'disc degeneration'
    ],
    icd10: 'M51.36'
  },
  
  // Auditory
  'SNHL': {
    standard: 'SNHL',
    canonical: 'Sensorineural Hearing Loss',
    variants: [
      'sensorineural hearing loss',
      'SNHL',
      'nerve deafness',
      'hearing loss'
    ],
    icd10: 'H90.5'
  }
};


// ═══════════════════════════════════════════════════════════════
// NORMALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize a medical condition name to standard abbreviation
 * @param {string} rawCondition - Raw matched condition text
 * @returns {Object} Normalized condition with metadata
 */
export function normalizeCondition(rawCondition) {
  const lower = rawCondition.toLowerCase().trim();
  
  // Check against all abbreviations and variants
  for (const [abbrev, data] of Object.entries(MEDICAL_ABBREVIATIONS)) {
    const allForms = [
      abbrev.toLowerCase(),
      data.canonical.toLowerCase(),
      ...data.variants.map(v => v.toLowerCase())
    ];
    
    // Exact match
    if (allForms.includes(lower)) {
      return {
        standard: data.standard,
        canonical: data.canonical,
        displayName: data.canonical,
        matchedText: rawCondition,
        matchType: 'exact',
        confidence: 'high',
        icd10: data.icd10
      };
    }
    
    // Partial match (e.g., "diabetes" matches "Diabetes Mellitus")
    for (const form of allForms) {
      if (lower.includes(form) || form.includes(lower)) {
        return {
          standard: data.standard,
          canonical: data.canonical,
          displayName: data.canonical,
          matchedText: rawCondition,
          matchType: 'partial',
          confidence: 'medium',
          icd10: data.icd10
        };
      }
    }
  }
  
  // No normalization found - return as-is
  return {
    standard: rawCondition,
    canonical: rawCondition,
    displayName: rawCondition,
    matchedText: rawCondition,
    matchType: 'none',
    confidence: 'low',
    icd10: null
  };
}


/**
 * Calculate similarity between two strings (Levenshtein distance)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score 0-1 (1 = identical)
 */
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1.0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(s1, s2);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance algorithm
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}


// ═══════════════════════════════════════════════════════════════
// DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

/**
 * Deduplicate extracted conditions using normalization and fuzzy matching
 * @param {Array} conditions - Raw extracted conditions
 * @returns {Object} Deduplicated conditions with merge audit trail
 */
export function deduplicateConditions(conditions) {
  const merged = [];
  const seen = new Map(); // Map of normalized key to merged condition
  const mergeLog = [];
  
  for (const condition of conditions) {
    // Normalize the condition label
    const normalized = normalizeCondition(condition.label);
    const key = normalized.standard;
    
    if (seen.has(key)) {
      // Duplicate found - merge occurrences
      const existing = seen.get(key);
      
      existing.totalOccurrences += condition.totalOccurrences;
      existing.occurrences.push(...condition.occurrences);
      existing.alternateLabels = Array.from(new Set([
        ...existing.alternateLabels,
        condition.label
      ]));
      
      // Log the merge
      mergeLog.push({
        type: 'duplicate',
        primary: existing.label,
        merged: condition.label,
        normalizedTo: key,
        occurrencesAdded: condition.totalOccurrences
      });
      
    } else {
      // New unique condition
      const mergedCondition = {
        ...condition,
        normalizedKey: key,
        displayName: normalized.canonical,
        standard: normalized.standard,
        alternateLabels: [condition.label],
        icd10: normalized.icd10,
        normalizationConfidence: normalized.confidence
      };
      
      seen.set(key, mergedCondition);
      merged.push(mergedCondition);
    }
  }
  
  // Sort by total occurrences (most mentioned first)
  merged.sort((a, b) => b.totalOccurrences - a.totalOccurrences);
  
  return {
    conditions: merged,
    originalCount: conditions.length,
    deduplicatedCount: merged.length,
    duplicatesRemoved: conditions.length - merged.length,
    deduplicationRate: ((conditions.length - merged.length) / conditions.length * 100).toFixed(1),
    mergeLog
  };
}


/**
 * Find potential duplicates using fuzzy matching
 * @param {Array} conditions - Conditions to check
 * @param {number} threshold - Similarity threshold (0-1, default 0.8)
 * @returns {Array} Potential duplicate pairs
 */
export function findPotentialDuplicates(conditions, threshold = 0.8) {
  const duplicates = [];
  
  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const sim = calculateSimilarity(conditions[i].label, conditions[j].label);
      
      if (sim >= threshold) {
        duplicates.push({
          condition1: conditions[i].label,
          condition2: conditions[j].label,
          similarity: (sim * 100).toFixed(1),
          recommendation: sim >= 0.95 ? 'merge' : 'review'
        });
      }
    }
  }
  
  return duplicates;
}


// ═══════════════════════════════════════════════════════════════
// CROSS-REFERENCE VALIDATION
// ═══════════════════════════════════════════════════════════════

export const MEDICATION_CONDITION_MAP = {
  'SSRIs': ['PTSD', 'MDD', 'GAD', 'Depression', 'Anxiety'],
  'Antidepressants': ['MDD', 'Depression', 'Anxiety', 'PTSD', 'Chronic pain'],
  'Anxiolytics': ['GAD', 'Anxiety', 'PTSD', 'Panic disorder'],
  'Pain medication': ['Back pain', 'Knee pain', 'Arthritis', 'Chronic pain', 'OA', 'DDD'],
  'Opioids': ['Chronic pain', 'Back pain', 'Post-surgical pain', 'Severe pain'],
  'Antihypertensives': ['HTN', 'Hypertension', 'CAD', 'CHF'],
  'Diabetes': ['DM', 'Type 2 diabetes', 'T2DM', 'T1DM'],
  'Statins': ['Hyperlipidemia', 'CAD', 'Atherosclerosis'],
  'Beta blockers': ['HTN', 'CAD', 'CHF', 'Arrhythmia'],
  'Inhalers': ['Asthma', 'COPD', 'Reactive airway disease']
};

/**
 * Cross-reference medications with conditions for validation
 * @param {Array} medications - Extracted medications
 * @param {Array} conditions - Extracted conditions
 * @returns {Object} Cross-referenced data with validation status
 */
export function crossReferenceMedications(medications, conditions) {
  const validated = [];
  const orphanedMeds = [];
  const expectedButMissing = [];
  
  for (const med of medications) {
    const expectedConditions = MEDICATION_CONDITION_MAP[med.label] || [];
    
    // Find matching conditions (normalize for comparison)
    const foundConditions = conditions
      .filter(c => {
        const cNorm = normalizeCondition(c.label);
        return expectedConditions.some(ec => 
          cNorm.canonical.toLowerCase().includes(ec.toLowerCase()) ||
          ec.toLowerCase().includes(cNorm.canonical.toLowerCase()) ||
          c.label.toLowerCase().includes(ec.toLowerCase())
        );
      })
      .map(c => c.label);
    
    const validatedMed = {
      ...med,
      treatsConditions: foundConditions,
      expectedConditions,
      validationStatus: foundConditions.length > 0 ? 'confirmed' : 'orphaned',
      confidence: foundConditions.length > 0 ? 'high' : 'low',
      warnings: foundConditions.length === 0 
        ? [`No matching condition found for ${med.label} - expected: ${expectedConditions.join(', ')}`]
        : []
    };
    
    if (foundConditions.length === 0) {
      orphanedMeds.push(validatedMed);
    }
    
    validated.push(validatedMed);
  }
  
  // Check for conditions that SHOULD have medications but don't
  for (const condition of conditions) {
    const cNorm = normalizeCondition(condition.label);
    const shouldHaveMeds = Object.entries(MEDICATION_CONDITION_MAP)
      .filter(([_medType, condList]) => 
        condList.some(ec => 
          cNorm.canonical.toLowerCase().includes(ec.toLowerCase()) ||
          ec.toLowerCase().includes(cNorm.canonical.toLowerCase())
        )
      )
      .map(([medType]) => medType);
    
    const hasMeds = medications.some(m => shouldHaveMeds.includes(m.label));
    
    if (!hasMeds && shouldHaveMeds.length > 0) {
      expectedButMissing.push({
        condition: condition.label,
        expectedMedications: shouldHaveMeds,
        note: 'Condition documented but expected medications not found'
      });
    }
  }
  
  return {
    medications: validated,
    orphanedCount: orphanedMeds.length,
    orphanedMedications: orphanedMeds,
    expectedButMissing,
    validationSummary: {
      totalMedications: medications.length,
      confirmed: validated.filter(m => m.validationStatus === 'confirmed').length,
      orphaned: orphanedMeds.length,
      confirmationRate: ((validated.filter(m => m.validationStatus === 'confirmed').length / medications.length) * 100).toFixed(1)
    }
  };
}


// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
  normalizeCondition,
  deduplicateConditions,
  findPotentialDuplicates,
  crossReferenceMedications,
  calculateSimilarity,
  MEDICAL_ABBREVIATIONS,
  MEDICATION_CONDITION_MAP
};
