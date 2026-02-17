/**
 * Classify disabilities as SC, NSC, or PSC
 * @param {Array} disabilities - List of disabilities from narrative
 * @param {Object} veteranData - Veteran service data
 * @returns {Object} Classified disabilities grouped by type
 */
export function classifyDisabilities(disabilities, veteranData) {
  const classified = disabilities.map(disability => {
    const classification = determineClassification(disability, veteranData);
    
    return {
      name: disability.condition,
      rating: disability.percentage || null,
      evidenceSource: disability.evidenceSource,
      classification: classification.type,
      classificationReason: classification.reason
    };
  });

  return {
    serviceConnected: classified.filter(d => d.classification === 'SC'),
    nonServiceConnected: classified.filter(d => d.classification === 'NSC'),
    potentiallyServiceConnectable: classified.filter(d => d.classification === 'PSC')
  };
}

function determineClassification(disability, veteranData) {
  // Already service-connected
  if (disability.percentage !== undefined) {
    return {
      type: 'SC',
      reason: 'Currently service-connected with established rating'
    };
  }

  // Check presumptive conditions
  const presumptive = checkPresumptive(disability, veteranData);
  if (presumptive) {
    return {
      type: 'PSC',
      reason: presumptive
    };
  }

  // Check secondary conditions
  const secondary = checkSecondary(disability, veteranData);
  if (secondary) {
    return {
      type: 'PSC',
      reason: secondary
    };
  }

  // Check combat-related
  if (veteranData.combatService === 'yes') {
    return {
      type: 'PSC',
      reason: 'Combat veteran - may qualify under 38 CFR § 3.304(f)'
    };
  }

  // Default to NSC if no connection found
  return {
    type: 'NSC',
    reason: 'No direct service connection or presumptive basis identified'
  };
}

function checkPresumptive(disability, veteranData) {
  const conditionLower = disability.condition.toLowerCase();
  
  try {
    const presumptives = require('../data/presumptives.json');
    for (const presumptive of presumptives) {
      if (conditionLower.includes(presumptive.condition.toLowerCase())) {
        const hasTheater = veteranData.servicePeriods?.some(period => 
          presumptive.theaters.includes(period.theater)
        );
        
        if (hasTheater) {
          return `Presumptive condition for ${presumptive.theaters.join('/')} service - ${presumptive.cfr}`;
        }
      }
    }
  } catch (e) {
    // Fallback if import fails
  }
  
  return null;
}

function checkSecondary(disability, veteranData) {
  const conditionLower = disability.condition.toLowerCase();
  
  try {
    const secondaryConditions = require('../data/secondaryConditions.json');
    for (const secondary of secondaryConditions) {
      if (conditionLower.includes(secondary.secondary.toLowerCase())) {
        return `Possible secondary to ${secondary.primary} - ${secondary.cfr}`;
      }
    }
  } catch (e) {
    // Fallback if import fails
  }
  
  return null;
}
