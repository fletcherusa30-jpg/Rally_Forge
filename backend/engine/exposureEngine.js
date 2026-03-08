/**
 * exposureEngine.js - Environmental Exposure Detection
 *
 * Evaluates military service for hazardous environmental exposures.
 * Links exposures to presumptive conditions (Agent Orange, burn pits, etc.)
 * Authority: 38 C.F.R. §3.304-3.309 (Presumptive Conditions)
 */

/**
 * Evaluate environmental exposures from service history
 * @param {Object} onboardingResult - Veteran onboarding record
 * @returns {Array} Array of detected exposures with evidence
 */
export function evaluateExposure(onboardingResult) {
  if (!onboardingResult) return [];

  const exposures = [];

  // Agent Orange exposure
  const agentOrangeExposure = detectAgentOrange(onboardingResult);
  if (agentOrangeExposure) exposures.push(agentOrangeExposure);

  // Burn pit exposure
  const burnPitExposure = detectBurnPits(onboardingResult);
  if (burnPitExposure) exposures.push(burnPitExposure);

  // Radiation exposure
  const radiationExposure = detectRadiation(onboardingResult);
  if (radiationExposure) exposures.push(radiationExposure);

  // Airborne hazards (depleted uranium, asbestos)
  const airbornExposure = detectAirbornHazards(onboardingResult);
  if (airbornExposure) exposures.push(airbornExposure);

  // Cold/tropical exposures
  const climateExposure = detectClimateExposures(onboardingResult);
  if (climateExposure) exposures.push(climateExposure);

  return exposures;
}

/**
 * Detect Agent Orange exposure
 * Authority: 38 C.F.R. §3.307(a)(6) - Presumptive Conditions (Agent Orange)
 */
function detectAgentOrange(onboardingResult) {
  const locations = (onboardingResult.servicePeriods || [])
    .map(p => `${p.location || ''}`.toLowerCase())
    .join(' ');
  
  const narrative = `${onboardingResult.narratives || []}`.toLowerCase();
  const fullText = locations + ' ' + narrative;

  const agentOrangeKeywords = [
    'agent orange', 'herbicide', 'dioxin', 'vietnam', 'thailand', 'da nang',
    'agent white', 'agent pink', 'orange zone'
  ];

  const detected = agentOrangeKeywords.some(keyword => fullText.includes(keyword));

  if (!detected) return null;

  return {
    type: 'Agent Orange',
    location: 'Vietnam/Thailand',
    confidence: 0.85,
    authority: '38 C.F.R. §3.307(a)(6)',
    evidence: [
      'Service in Vietnam, Thailand, or areas known for Agent Orange use',
      'Exposure to herbicide operations'
    ],
    presumptiveConditions: [
      'AL Amyloidosis', 'Bladder Cancer', 'Diabetes Type 2',
      'Hodgkins Lymphoma', 'Ischemic Heart Disease', 'Kidney Cancer',
      'Multiple Myeloma', 'Non-Hodgkins Lymphoma', 'Prostate Cancer',
      'Soft Tissue Sarcoma', 'Respiratory Cancers'
    ]
  };
}

/**
 * Detect burn pit exposure (Iraq/Afghanistan)
 * Authority: 38 C.F.R. §3.307(a)(7)
 */
function detectBurnPits(onboardingResult) {
  const locations = (onboardingResult.servicePeriods || [])
    .map(p => `${p.location || ''}`.toLowerCase())
    .join(' ');

  const narrative = `${onboardingResult.narratives || []}`.toLowerCase();
  const fullText = locations + ' ' + narrative;

  const burnPitKeywords = [
    'burn pit', 'open burn pit', 'waste burn', 'iraq', 'afghanistan',
    'kuwait', 'qatar', 'respiratory'
  ];

  const detected = burnPitKeywords.some(keyword => fullText.includes(keyword));
  const serviceInIraqAfghan = onboardingResult.servicePeriods?.some(p => {
    const loc = `${p.location || ''}`.toLowerCase();
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    return (loc.includes('iraq') || loc.includes('afghanistan')) &&
           start >= new Date('2001-01-01') && end <= new Date('2022-12-31');
  });

  if (!detected && !serviceInIraqAfghan) return null;

  return {
    type: 'Burn Pit',
    location: 'Iraq/Afghanistan',
    confidence: serviceInIraqAfghan ? 0.9 : 0.7,
    authority: '38 C.F.R. §3.307(a)(7)',
    evidence: [
      'Service in Iraq or Afghanistan after 2001',
      'Potential exposure to open burn pits and airborne hazards'
    ],
    presumptiveConditions: [
      'Asthma', 'Chronic Bronchitis', 'COPD', 'Constrictive Bronchiolitis',
      'Granulomatous Disease', 'Interstitial Lung Disease', 'Pleuritis',
      'Pulmonary Fibrosis', 'Sarcoidosis'
    ]
  };
}

/**
 * Detect radiation exposure
 * Authority: 38 C.F.R. §3.307(a)(8)
 */
function detectRadiation(onboardingResult) {
  const narrative = `${onboardingResult.narratives || []}`.toLowerCase();
  const serviceBranch = `${onboardingResult.branch || ''}`.toLowerCase();

  const radiationKeywords = [
    'radiation', 'atomic', 'nuclear test', 'hiroshima', 'nagasaki',
    'uranium', 'nuclear weapon', 'radiation technician', 'reactor'
  ];

  const detected = radiationKeywords.some(keyword => narrative.includes(keyword));
  const nuclearService = serviceBranch.includes('nuclear') || 
                        (onboardingResult.militarySpecialty || '').toLowerCase().includes('nuclear');

  if (!detected && !nuclearService) return null;

  return {
    type: 'Radiation',
    location: 'Nuclear weapons test sites or military nuclear programs',
    confidence: nuclearService ? 0.9 : 0.75,
    authority: '38 C.F.R. §3.307(a)(8)',
    evidence: [
      'Service in nuclear weapons development/testing',
      'Occupational radiation exposure'
    ],
    presumptiveConditions: [
      'Leukemia', 'Lymphoma', 'Cancer (multiple types)',
      'Thyroid Disease', 'Cataracts'
    ]
  };
}

/**
 * Detect airborne hazards (asbestos, depleted uranium, etc.)
 */
function detectAirbornHazards(onboardingResult) {
  const narrative = `${onboardingResult.narratives || []}`.toLowerCase();
  const specialty = `${onboardingResult.militarySpecialty || ''}`.toLowerCase();

  const hazardKeywords = [
    'asbestos', 'depleted uranium', 'dust', 'occupational', 'maintenance',
    'welding', 'shipyard', 'ammunition'
  ];

  const detected = hazardKeywords.some(keyword => narrative.includes(keyword) || specialty.includes(keyword));

  if (!detected) return null;

  return {
    type: 'Airborne Hazards',
    location: 'Military bases, maintenance, ammunition facilities',
    confidence: 0.7,
    authority: '38 C.F.R. §3.309',
    evidence: ['Occupational exposure to airborne hazards'],
    presumptiveConditions: ['Respiratory diseases', 'Lung disease', 'Asbestos-related conditions']
  };
}

/**
 * Detect climate/tropical exposures
 */
function detectClimateExposures(onboardingResult) {
  const locations = (onboardingResult.servicePeriods || [])
    .map(p => `${p.location || ''}`.toLowerCase())
    .join(' ');

  const tropicalZones = ['thailand', 'vietnam', 'cambodia', 'laos', 'jungle', 'tropical'];
  const detected = tropicalZones.some(zone => locations.includes(zone));

  if (!detected) return null;

  return {
    type: 'Tropical/Climate Exposure',
    location: 'Southeast Asia, tropical regions',
    confidence: 0.8,
    authority: '38 C.F.R. §3.307-3.309',
    evidence: ['Service in tropical climate'],
    presumptiveConditions: ['Malaria', 'Dengue Fever', 'Other tropical diseases']
  };
}

export default { evaluateExposure };

