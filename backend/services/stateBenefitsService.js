/**
 * ⚠️  DEPRECATED: Use backend/domain/engines/BenefitsEngine.js instead.
 * 
 * This service layer is being consolidated into the domain engine.
 * Will be removed in Phase 4 (Backend Services Refactor).
 * 
 * State Benefits Database Service
 * 
 * Integrates the canonical state benefits dataset
 * into the Rally Forge system for state-specific benefit recommendations.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadUnifiedStateBenefits,
  loadUnifiedStateBenefitsAudit,
  getUnifiedStateBenefitsByCode,
} from './stateBenefitsService.generated.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, '../../knowledge/State_Benefits');

let benefitsCache = null;
let structuredBenefitsCache = null;

const normalizeStateCode = (stateCode) => String(stateCode || '').trim().toUpperCase();

const conditionFlags = (conditions) => {
  const items = Array.isArray(conditions) ? conditions.map((item) => String(item || '').toLowerCase()) : [];
  return {
    requiresServiceConnection: items.some((item) => /service/.test(item)),
    requiresHomeowner: items.some((item) => /homeowner|property owner|owner occupied/.test(item)),
    requiresWartimeService: items.some((item) => /wartime/.test(item)),
    requiresCombatFlag: items.some((item) => /combat/.test(item)),
  };
};

const toLegacyBenefit = (benefit, stateCode, stateName, index) => {
  const eligibility = benefit?.eligibility || {};
  const conditions = Array.isArray(eligibility.conditions) ? eligibility.conditions : [];
  const flags = conditionFlags(conditions);
  const ratingMin = Number(eligibility.ratingThreshold || 0);
  const name = String(benefit?.title || '').trim() || 'Untitled Benefit';
  const description = String(benefit?.description || '').trim();
  const link = benefit?.url ? String(benefit.url) : null;

  return {
    id: `${stateCode}-${String(benefit?.category || 'Other').replace(/\s+/g, '-')}-${index}`,
    state_code: stateCode,
    state_name: stateName,
    category: String(benefit?.category || 'Other'),
    name,
    description,
    benefit_details: description,
    rating_min: ratingMin,
    minimumRating: ratingMin,
    requires: [...conditions],
    requires_service_connection: flags.requiresServiceConnection,
    requires_homeowner: flags.requiresHomeowner,
    requires_wartime_service: flags.requiresWartimeService,
    requires_combat_flag: flags.requiresCombatFlag,
    links: { learnMore: link },
    link,
    criteria: { rating_min: ratingMin },
    active: true,
    source: benefit?.provenance || 'state',
  };
};

const toLegacyStateRecord = (record) => {
  const stateCode = normalizeStateCode(record?.stateCode);
  const stateName = String(record?.stateName || stateCode);
  const categories = {};

  (record?.benefits || []).forEach((benefit, index) => {
    const category = String(benefit?.category || 'Other');
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(toLegacyBenefit(benefit, stateCode, stateName, index));
  });

  return {
    name: stateName,
    code: stateCode,
    categories,
    federal: record?.federal || { programs: [] },
  };
};

const legacyBenefitsListFromRecord = (record) => {
  const stateCode = normalizeStateCode(record?.stateCode);
  const stateName = String(record?.stateName || stateCode);
  return (record?.benefits || []).map((benefit, index) => toLegacyBenefit(benefit, stateCode, stateName, index));
};

const parseBenefitsDatabase = (content) => {
  const benefits = {};
  const lines = content.split(/\r?\n/);
  
  let currentState = null;
  let currentCategory = null;
  let currentBenefit = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // State header (## StateName (ST))
    const stateMatch = line.match(/^## ([A-Za-z\s]+)\s+\(([A-Z]{2})\)$/);
    if (stateMatch) {
      currentState = {
        name: stateMatch[1].trim(),
        code: stateMatch[2],
        categories: {}
      };
      benefits[currentState.code] = currentState;
      currentCategory = null;
      continue;
    }
    
    // Category header (### Category)
    const categoryMatch = line.match(/^### ([A-Za-z/\s&]+)$/);
    if (categoryMatch && currentState) {
      currentCategory = categoryMatch[1].trim();
      if (!currentState.categories[currentCategory]) {
        currentState.categories[currentCategory] = [];
      }
      currentBenefit = null;
      continue;
    }
    
    // Benefit name (**Name:** ...)
    const nameMatch = line.match(/^\*\*Name:\*\*\s*(.+)$/);
    if (nameMatch && currentState && currentCategory) {
      currentBenefit = {
        name: nameMatch[1].trim(),
        description: null,
        minimumRating: null,
        requires: [],
        link: null,
        fields: {}
      };
      currentState.categories[currentCategory].push(currentBenefit);
      continue;
    }
    
    // Description (**Description:** ...)
    const descMatch = line.match(/^\*\*Description:\*\*\s*(.+)$/);
    if (descMatch && currentBenefit) {
      currentBenefit.description = descMatch[1].trim();
      continue;
    }
    
    // Minimum Rating (**Minimum Rating:** ...)
    const ratingMatch = line.match(/^\*\*Minimum Rating:\*\*\s*(.+)$/);
    if (ratingMatch && currentBenefit) {
      const rating = ratingMatch[1].trim();
      currentBenefit.minimumRating = rating === '0%' ? 0 : parseInt(rating);
      continue;
    }
    
    // Requirements (**Requires:** ...)
    const reqMatch = line.match(/^\*\*Requires:\*\*\s*(.+)$/);
    if (reqMatch && currentBenefit) {
      currentBenefit.requires.push(reqMatch[1].trim());
      continue;
    }
    
    // Link (**Link:** ...)
    const linkMatch = line.match(/^\*\*Link:\*\*\s*(.+)$/);
    if (linkMatch && currentBenefit) {
      currentBenefit.link = linkMatch[1].trim();
      continue;
    }
  }
  
  return benefits;
};

/**
 * Get benefits by state code
 */
export const getBenefitsByState = async (stateCode) => {
  const state = await getUnifiedStateBenefitsByCode(stateCode);
  if (!state) return null;
  return toLegacyStateRecord(state);
};

export const getStructuredBenefitsByState = async (stateCode) => {
  const state = await getUnifiedStateBenefitsByCode(stateCode);
  if (!state) return [];
  return legacyBenefitsListFromRecord(state);
};

export const getEligibleStructuredBenefits = async ({
  stateCode,
  rating = 0,
  serviceConnected = false,
  combatVeteran = false,
  wartimeVeteran = false,
  homeowner = false,
}) => {
  const stateBenefits = await getStructuredBenefitsByState(stateCode);
  const numericRating = Number.isFinite(Number(rating)) ? Number(rating) : 0;

  const eligible = stateBenefits.filter((benefit) => {
    if (Number(benefit.rating_min || 0) > numericRating) return false;
    if (benefit.requires_service_connection && !serviceConnected) return false;
    if (benefit.requires_combat_flag && !combatVeteran) return false;
    if (benefit.requires_wartime_service && !wartimeVeteran) return false;
    if (benefit.requires_homeowner && !homeowner) return false;
    return true;
  });

  return {
    stateCode: normalizeStateCode(stateCode),
    profile: {
      rating: numericRating,
      serviceConnected,
      combatVeteran,
      wartimeVeteran,
      homeowner,
    },
    totalInState: stateBenefits.length,
    eligibleCount: eligible.length,
    eligible,
  };
};

/**
 * Get benefits for a veteran based on state and rating
 */
export const getVeteranBenefits = async (stateCode, combinedRating) => {
  const stateData = await getBenefitsByState(stateCode);
  
  if (!stateData) {
    return {
      state: stateCode,
      rating: combinedRating,
      eligible: [],
      message: `No benefits data found for ${stateCode}`
    };
  }
  
  const eligible = [];
  
  // Iterate through all categories
  Object.entries(stateData.categories).forEach(([category, benefits]) => {
    benefits.forEach(benefit => {
      // Check if veteran meets minimum rating requirement
      if (benefit.minimumRating === null || combinedRating >= benefit.minimumRating) {
        eligible.push({
          ...benefit,
          category,
          state: stateCode,
          meetsRatingRequirement: true,
          ratingThreshold: benefit.minimumRating
        });
      }
    });
  });
  
  return {
    state: stateCode,
    stateName: stateData.name,
    rating: combinedRating,
    eligible,
    count: eligible.length,
    categoriesAvailable: Object.keys(stateData.categories)
  };
};

/**
 * Get all available states
 */
export const getAllStates = async () => {
  const dataset = await loadUnifiedStateBenefits();
  return (dataset.records || []).map((record) => {
    const categories = Array.from(new Set((record.benefits || []).map((benefit) => String(benefit.category || 'Other')))).sort();
    return {
      code: normalizeStateCode(record.stateCode),
      name: String(record.stateName || record.stateCode),
      benefitsCount: Array.isArray(record.benefits) ? record.benefits.length : 0,
      categories,
    };
  });
};

/**
 * Get benefits by category across all states
 */
export const getBenefitsByCategory = async (category) => {
  const dataset = await loadUnifiedStateBenefits();
  const results = {};
  const normalizedCategory = String(category || '').toLowerCase();
  
  (dataset.records || []).forEach((record) => {
    const matches = legacyBenefitsListFromRecord(record).filter(
      (benefit) => String(benefit.category || '').toLowerCase() === normalizedCategory
    );
    if (matches.length > 0) {
      const code = normalizeStateCode(record.stateCode);
      results[code] = {
        state: String(record.stateName || code),
        benefits: matches,
      };
    }
  });
  
  return results;
};

/**
 * Search benefits across all states
 */
export const searchBenefits = async (searchTerm) => {
  const dataset = await loadUnifiedStateBenefits();
  const normalizedQuery = String(searchTerm || '').toLowerCase().replace(/\+/g, ' ').trim();
  const searchTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const results = [];

  if (searchTokens.length === 0) {
    return results;
  }
  
  (dataset.records || []).forEach((record) => {
    const stateCode = normalizeStateCode(record.stateCode);
    const stateName = String(record.stateName || stateCode);
    const addIfMatch = (benefit) => {
      const haystack = [
        benefit.name,
        benefit.description,
        benefit.category,
        ...(Array.isArray(benefit.requires) ? benefit.requires : []),
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      const matches = searchTokens.every((token) => haystack.includes(token));
      if (!matches) return;

      results.push({
        ...benefit,
        state: stateCode,
        stateName,
      });
    };

    legacyBenefitsListFromRecord(record).forEach((benefit) => {
      addIfMatch(benefit);
    });

    const federalPrograms = Array.isArray(record?.federal?.programs) ? record.federal.programs : [];
    federalPrograms.forEach((program, index) => {
      addIfMatch({
        id: `${stateCode}-federal-${index}`,
        category: String(program?.category || 'Federal Program'),
        name: String(program?.title || '').trim() || 'Federal Program',
        description: String(program?.description || '').trim(),
        requires: Array.isArray(program?.eligibility?.conditions) ? program.eligibility.conditions : [],
        link: program?.url ? String(program.url) : null,
        source: program?.provenance || 'federal',
      });
    });
  });
  
  return results;
};

/**
 * Get summary statistics
 */
export const getDatabaseStatistics = async () => {
  const dataset = await loadUnifiedStateBenefits();
  const audit = await loadUnifiedStateBenefitsAudit();
  
  let totalBenefits = 0;
  let totalCategories = new Set();
  let benefitsByRating = {};
  
  (dataset.records || []).forEach((state) => {
    const categories = {};
    legacyBenefitsListFromRecord(state).forEach((benefit) => {
      const category = String(benefit.category || 'Other');
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(benefit);
    });

    Object.entries(categories).forEach(([category, benefits]) => {
      totalCategories.add(category);
      benefits.forEach((benefit) => {
        totalBenefits++;
        const rating = Number(benefit.minimumRating ?? benefit.rating_min ?? 0);
        if (!benefitsByRating[rating]) {
          benefitsByRating[rating] = 0;
        }
        benefitsByRating[rating]++;
      });
    });
  });
  
  return {
    totalStates: Array.isArray(dataset.records) ? dataset.records.length : 0,
    totalBenefits,
    totalCategories: totalCategories.size,
    categories: Array.from(totalCategories).sort(),
    benefitsByMinimumRating: benefitsByRating,
    metadata: {
      generatedAt: new Date().toISOString(),
      dataSource: 'resources/state-benefits.json',
      schemaVersion: audit?.schemaVersion || dataset?.schemaVersion || '1.0.0',
    }
  };
};

/**
 * Get comparison of benefits across multiple states
 */
export const compareBenefitsAcrossStates = async (stateCodes) => {
  const comparison = {};
  
  for (const stateCode of stateCodes) {
    const stateData = await getBenefitsByState(stateCode);
    if (stateData) {
      comparison[stateCode] = {
        state: stateData.name,
        totalBenefits: Object.values(stateData.categories).reduce(
          (sum, benefits) => sum + benefits.length,
          0
        ),
        categories: {}
      };
      
      Object.entries(stateData.categories).forEach(([category, benefits]) => {
        comparison[stateCode].categories[category] = benefits.length;
      });
    }
  }
  
  return comparison;
};
