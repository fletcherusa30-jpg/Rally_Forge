/**
 * combatEngine.js - Combat Service Detection
 *
 * Evaluates military service periods for combat exposure.
 * Links service history to combat-related presumptive conditions.
 * Authority: 38 C.F.R. §3.303a (War Hazards), specific combat locations
 */

/**
 * Detect combat service from onboarding data
 * @param {Object} onboardingResult - Veteran onboarding record
 * @returns {Object} Combat evaluation with exposures and pathways
 */
export function evaluateCombat(onboardingResult) {
  if (!onboardingResult) return { combatFlag: false, exposures: [], presumptivePathways: [] };

  // Extract service periods
  const servicePeriods = Array.isArray(onboardingResult.servicePeriods) 
    ? onboardingResult.servicePeriods 
    : [];

  // Combat flag from self-report
  const combatSelfReport = onboardingResult.combatSelfReport === 'Yes';

  // Combat location detections (from service history or narrative)
  const combatLocations = detectCombatLocations(servicePeriods, onboardingResult.narratives || []);

  // Awards that indicate combat (Bronze Star, Purple Heart, etc.)
  const combatAwards = detectCombatAwards(onboardingResult.awards || []);

  // Service periods overlapping combat zones
  const combatZoneExposure = servicePeriods.some(period => 
    isCombatZonePeriod(period.startDate, period.endDate, combatLocations)
  );

  const hasCombatExposure = combatSelfReport || combatAwards.length > 0 || combatZoneExposure;

  // Build exposure list
  const exposures = [];
  if (hasCombatExposure) {
    exposures.push({
      type: 'Combat Service',
      confidence: combatSelfReport ? 0.95 : (combatAwards.length > 0 ? 0.9 : 0.7),
      evidence: [
        ...(combatSelfReport ? ['Self-reported combat service'] : []),
        ...(combatAwards.length > 0 ? [`Combat awards: ${combatAwards.join(', ')}`] : []),
        ...(combatZoneExposure ? ['Service overlap with combat zone'] : [])
      ]
    });
  }

  // Combat-related presumptive conditions
  const presumptivePathways = [];
  if (hasCombatExposure) {
    presumptivePathways.push(
      { condition: 'PTSD', authority: '38 C.F.R. §3.307(a)(3)', requirement: 'Qualifying stressor' },
      { condition: 'Tinnitus', authority: '38 C.F.R. §3.307(a)(4)', requirement: 'Service-connected hearing loss' },
      { condition: 'Sleep Apnea', authority: '38 C.F.R. §3.307(a)(5)', requirement: 'Combat service + symptoms' }
    );
  }

  return {
    combatFlag: hasCombatExposure,
    exposures,
    presumptivePathways,
    evidence: {
      selfReport: combatSelfReport,
      awards: combatAwards,
      locations: combatLocations,
      zoneOverlap: combatZoneExposure
    }
  };
}

/**
 * Detect combat locations from service history
 */
function detectCombatLocations(servicePeriods, narratives) {
  const combatZones = [
    'Iraq', 'Afghanistan', 'Kuwait', 'Saudi Arabia', 'Persian Gulf',
    'Vietnam', 'Cambodia', 'Laos', 'Thailand',
    'Korea', 'Bosnia', 'Croatia', 'Serbia', 'Kosovo',
    'Lebanon', 'Grenada', 'Panama', 'Somalia'
  ];

  const locations = new Set();

  // Check service narratives for location keywords
  const narrative = (narratives.join(' ') + '').toLowerCase();
  combatZones.forEach(zone => {
    if (narrative.includes(zone.toLowerCase())) {
      locations.add(zone);
    }
  });

  return Array.from(locations);
}

/**
 * Detect combat-indicating awards
 */
function detectCombatAwards(awards) {
  const combatAwards = [
    'Bronze Star', 'Silver Star', 'Distinguished Service Cross', 'Medal of Honor',
    'Purple Heart', 'Air Medal', 'Combat Infantryman Badge',
    'Combat Action Badge', 'Navy/Marine Corps Combat Action Ribbon'
  ];

  const awardsLower = (Array.isArray(awards) ? awards : []).map(a => String(a || '').toLowerCase());
  
  return combatAwards.filter(award =>
    awardsLower.some(a => a.includes(award.toLowerCase()))
  );
}

/**
 * Check if service period overlaps with known combat zones/dates
 */
function isCombatZonePeriod(startDate, endDate, locations) {
  if (!startDate || !endDate || locations.length === 0) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Major combat periods (simplified; real data would use exhaustive date ranges)
  const combatPeriods = {
    'Iraq': { start: new Date('2003-03-20'), end: new Date('2011-12-31') },
    'Afghanistan': { start: new Date('2001-10-07'), end: new Date('2021-08-30') },
    'Vietnam': { start: new Date('1964-08-02'), end: new Date('1973-01-27') },
    'Korea': { start: new Date('1950-06-25'), end: new Date('1953-07-27') }
  };

  return locations.some(location => {
    const combatPeriod = combatPeriods[location];
    if (!combatPeriod) return false;
    return start <= combatPeriod.end && end >= combatPeriod.start;
  });
}

export default { evaluateCombat };

