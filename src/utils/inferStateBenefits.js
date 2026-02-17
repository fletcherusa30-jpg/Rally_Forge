/**
 * Infer state-specific benefits based on veteran data
 * @param {Object} input - Veteran profile with state information
 * @returns {Object} Categorized state benefits
 */
export function inferStateBenefits(input) {
  const { state, combinedRating, serviceInfo, classifiedDisabilities } = input;

  const categories = {
    'Property Tax Exemptions': [],
    'Education Benefits': [],
    'Licenses & Permits': [],
    'Vehicle Registration': [],
    'Parks & Recreation': [],
    'Disability Bonuses': [],
    'Employment Preferences': [],
    'Grants & Stipends': [],
    'Burial Benefits': []
  };

  try {
    const stateBenefitsData = require('../data/stateBenefits.json');
    const stateData = stateBenefitsData.find(s => s.state === state);

    if (!stateData) {
      return { categories };
    }

    stateData.benefits.forEach(benefit => {
      const meetsRating = !benefit.ratingThreshold || combinedRating >= benefit.ratingThreshold;
      const meetsCombat = !benefit.requiresCombat || serviceInfo?.combatService === 'yes';
      
      if (meetsRating && meetsCombat) {
        const category = benefit.category || 'Other Benefits';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(benefit);
      }
    });
  } catch (e) {
    // Fallback if data file doesn't exist
  }

  return { categories };
}
