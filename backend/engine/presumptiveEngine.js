/**
 * presumptiveEngine.js - Presumptive Claims Pathway Builder
 *
 * Converts detected exposures into presumptive condition claim pathways.
 * Maps exposures → presumptive conditions → evidence requirements
 * Authority: 38 C.F.R. §3.303a (War Hazards), §3.304-309 (Presumptive Conditions)
 */

/**
 * Build presumptive pathways from exposures
 * @param {Array} exposures - Array of exposure objects (from exposureEngine)
 * @returns {Array} Array of presumptive condition pathways
 */
export function buildPresumptivePathways(exposures) {
  if (!Array.isArray(exposures) || exposures.length === 0) {
    return [];
  }

  const pathways = [];
  const conditionsSeen = new Set();

  exposures.forEach(exposure => {
    if (!exposure.presumptiveConditions || !Array.isArray(exposure.presumptiveConditions)) {
      return;
    }

    exposure.presumptiveConditions.forEach(condition => {
      // Avoid duplicates
      if (conditionsSeen.has(condition)) {
        return;
      }
      conditionsSeen.add(condition);

      // Build pathway object
      const pathway = buildPathwayForCondition(condition, exposure);
      pathways.push(pathway);
    });
  });

  return pathways;
}

/**
 * Build individual presumptive condition pathway
 */
function buildPathwayForCondition(conditionName, exposureSource) {
  const condition = PRESUMPTIVE_CONDITIONS[conditionName.toLowerCase().replace(/\s+/g, '_')];

  if (!condition) {
    // Fallback for unmapped condition
    return {
      condition: conditionName,
      exposureSource: exposureSource.type,
      authority: exposureSource.authority,
      status: 'Presumptive Eligibility',
      evidence_required: [
        'Medical diagnosis of condition',
        'Service in exposure location/period',
        'No other intervening cause'
      ],
      application_strategy: 'File presumptive claim with VA',
      approval_likelihood: 0.75
    };
  }

  return {
    condition: conditionName,
    exposureSource: exposureSource.type,
    authority: condition.authority,
    status: 'Presumptive Eligibility',
    presumption_rationale: condition.rationale,
    evidence_required: condition.evidenceRequired,
    medical_references: condition.medicalReferences,
    application_strategy: condition.applicationStrategy,
    approval_likelihood: 0.85,
    notes: condition.notes
  };
}

/**
 * Comprehensive Presumptive Conditions Database
 * Authority: 38 C.F.R. §3.303a, §3.304-309
 */
const PRESUMPTIVE_CONDITIONS = {
  asthma: {
    authority: '38 C.F.R. §3.307(a)(7)',
    rationale: 'Exposure to burn pit smoke in Iraq/Afghanistan',
    evidenceRequired: [
      'Medical diagnosis of asthma (post-deployment)',
      'Service in Iraq, Afghanistan, Kuwait, or Qatar after 2001',
      'Onset within 10 years of deployment'
    ],
    medicalReferences: ['ICD-10: J45', 'Spirometry showing reversible obstruction'],
    applicationStrategy: 'File VA Form 21-526EZ with medical records showing post-service onset',
    notes: 'High approval rate with spirometry results'
  },

  chronic_bronchitis: {
    authority: '38 C.F.R. §3.307(a)(7)',
    rationale: 'Inhalation exposure in burn pit areas',
    evidenceRequired: [
      'Chronic cough lasting 3+ months',
      'Chest X-ray or CT findings',
      'Service in Iraq/Afghanistan'
    ],
    medicalReferences: ['GOLD guidelines', 'CT chest showing bronchitis pattern'],
    applicationStrategy: 'File with pulmonology evaluation',
    notes: 'Distinguish from asthma and COPD'
  },

  agent_orange_presumptive: {
    authority: '38 C.F.R. §3.307(a)(6)',
    rationale: 'Herbicide exposure in Vietnam/Thailand',
    evidenceRequired: [
      'Service in Vietnam between 1962-1975',
      'OR service in Thailand near military bases 1962-1975',
      'Medical diagnosis of presumptive condition'
    ],
    medicalReferences: ['Vietnam Veterans\' Health Registry', 'Agent Orange exposure documentation'],
    applicationStrategy: 'File Agent Orange presumptive claim; location and dates usually sufficient',
    notes: 'Location-based presumption; medical diagnosis still required'
  },

  diabetes_type_2: {
    authority: '38 C.F.R. §3.307(a)(6)',
    rationale: 'Agent Orange creates insulin resistance',
    evidenceRequired: [
      'Diagnosis of Type 2 diabetes',
      'Service in Vietnam or affected areas',
      'Diagnosed after service (no temporal restriction)'
    ],
    medicalReferences: ['Fasting glucose', 'HbA1c', 'Vietnam Veterans\' Health Study'],
    applicationStrategy: 'File VA Form 21-526EZ with diabetes diagnosis'
  },

  ischemic_heart_disease: {
    authority: '38 C.F.R. §3.307(a)(6)',
    rationale: 'Agent Orange dioxin effects on cardiovascular system',
    evidenceRequired: [
      'Diagnosis: MI, angina, coronary artery disease, or equivalent',
      'Service in Vietnam or exposed areas',
      'Onset before age when IHD typically appears (usually <50y)'
    ],
    medicalReferences: ['Cardiac catheterization', 'Stress test', 'EKG with ischemic changes'],
    applicationStrategy: 'File with cardiology records and Vietnam service documentation',
    notes: 'Age of onset considered; earlier onset strengthens case'
  },

  prostate_cancer: {
    authority: '38 C.F.R. §3.307(a)(6)',
    rationale: 'Agent Orange exposure increases risk',
    evidenceRequired: [
      'Biopsy-confirmed prostate cancer diagnosis',
      'Age ≥50 OR presence of metastatic disease',
      'Vietnam service'
    ],
    medicalReferences: ['PSA level', 'Biopsy pathology', 'Gleason score'],
    applicationStrategy: 'File with oncology/urology records and biopsy results',
    notes: 'Approval often automatic if biopsy-confirmed'
  },

  multiple_myeloma: {
    authority: '38 C.F.R. §3.307(a)(6)',
    rationale: 'Agent Orange and/or radiation exposure',
    evidenceRequired: [
      'Confirmed myeloma diagnosis (serum protein, bone marrow biopsy)',
      'Service in Vietnam, radiation, or other exposure area'
    ],
    medicalReferences: ['M-spike on SPEP', 'Bone marrow biopsy', 'Lytic lesions on imaging'],
    applicationStrategy: 'File with hematology-oncology diagnosis documentation',
    notes: 'Multiple exposures may strengthen claim'
  },

  ptsd: {
    authority: '38 C.F.R. §3.307(a)(3)',
    rationale: 'Qualifying stressor from combat service',
    evidenceRequired: [
      'DSM-5 diagnosis of PTSD',
      'Qualifying stressor (combat, hostile fire, captivity, etc.)',
      'Nexus between stressor and current symptoms'
    ],
    medicalReferences: ['VA disability exam', 'Mental health treatment records', 'PCL-5 score'],
    applicationStrategy: 'File VA Form 21-526EZ with mental health evaluation and buddy letter',
    notes: 'Stressor must be corroborated; consider alternative diagnoses'
  },

  tinnitus: {
    authority: '38 C.F.R. §3.307(a)(4)',
    rationale: 'Noise exposure and/or traumatic brain injury',
    evidenceRequired: [
      'Diagnosis of tinnitus (medical history)',
      'Audiometry documenting hearing loss',
      'Service-connected exposure (combat, weapons, blast)'
    ],
    medicalReferences: ['Audiogram', 'Otologic exam', 'Military occupational exposure'],
    applicationStrategy: 'File with audiometry results; relatively high approval rate',
    notes: 'Hearing protection use in service affects claim'
  },

  radiation_cancer: {
    authority: '38 C.F.R. §3.307(a)(8)',
    rationale: 'Ionizing radiation exposure from nuclear weapons tests/operations',
    evidenceRequired: [
      'Confirmed cancer diagnosis',
      'Documentation of service in radiation area',
      'Medical evidence linking to radiation exposure'
    ],
    medicalReferences: ['Biopsy/pathology', 'Radiation exposure registry', 'Dose reconstruction'],
    applicationStrategy: 'Request Access to Records; file with all documentation'
  }
};

/**
 * Alternative builder for legacy exposures (stored as string list)
 * @param {Array<string>} exposures - Array of exposure type strings
 * @returns {Array} Array of pathways
 */
export function buildPathwaysFromExposureStrings(exposures) {
  const pathways = [];

  const exposureMap = {
    'Agent Orange': ['Diabetes Type 2', 'IHD', 'Prostate Cancer', 'Multiple Myeloma'],
    'Burn Pit': ['Asthma', 'Chronic Bronchitis', 'COPD', 'Pulmonary Fibrosis'],
    'Radiation': ['Leukemia', 'Lymphoma', 'Multiple Myeloma', 'Thyroid Cancer'],
    'Combat': ['PTSD', 'Tinnitus']
  };

  exposures.forEach(exposure => {
    const conditions = exposureMap[exposure] || [];
    if (!Array.isArray(conditions)) return;

    conditions.forEach(condition => {
      pathways.push({
        condition,
        exposureSource: exposure,
        status: 'Presumptive Eligible'
      });
    });
  });

  return pathways;
}

export default { buildPresumptivePathways, buildPathwaysFromExposureStrings };

