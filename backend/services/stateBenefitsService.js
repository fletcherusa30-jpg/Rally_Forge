/**
 * State Benefits Database Service
 * 
 * Integrates the comprehensive 250-benefit STATE_BENEFITS_DATABASE.md
 * into the Rally Forge system for state-specific benefit recommendations.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, '../../knowledge/STATE_BENEFITS');

let benefitsCache = null;

/**
 * Parse the STATE_BENEFITS_DATABASE.md file
 */
const parseBenefitsDatabase = (content) => {
  const benefits = {};
  const lines = content.split('\n');
  
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
 * Load the benefits database
 */
const loadBenefitsDatabase = async () => {
  if (!benefitsCache) {
    const dbPath = path.join(KNOWLEDGE_BASE_DIR, 'STATE_BENEFITS_DATABASE.md');
    const content = await fs.readFile(dbPath, 'utf-8');
    benefitsCache = parseBenefitsDatabase(content);
  }
  return benefitsCache;
};

/**
 * Get benefits by state code
 */
export const getBenefitsByState = async (stateCode) => {
  const database = await loadBenefitsDatabase();
  const state = database[stateCode];
  
  if (!state) {
    return null;
  }
  
  return state;
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
  const database = await loadBenefitsDatabase();
  return Object.entries(database).map(([code, state]) => ({
    code,
    name: state.name,
    benefitsCount: Object.values(state.categories).reduce(
      (sum, benefits) => sum + benefits.length,
      0
    ),
    categories: Object.keys(state.categories)
  }));
};

/**
 * Get benefits by category across all states
 */
export const getBenefitsByCategory = async (category) => {
  const database = await loadBenefitsDatabase();
  const results = {};
  
  Object.entries(database).forEach(([stateCode, state]) => {
    if (state.categories[category]) {
      results[stateCode] = {
        state: state.name,
        benefits: state.categories[category]
      };
    }
  });
  
  return results;
};

/**
 * Search benefits across all states
 */
export const searchBenefits = async (searchTerm) => {
  const database = await loadBenefitsDatabase();
  const lowerSearchTerm = searchTerm.toLowerCase();
  const results = [];
  
  Object.entries(database).forEach(([stateCode, state]) => {
    Object.entries(state.categories).forEach(([category, benefits]) => {
      benefits.forEach(benefit => {
        if (
          benefit.name.toLowerCase().includes(lowerSearchTerm) ||
          (benefit.description && benefit.description.toLowerCase().includes(lowerSearchTerm))
        ) {
          results.push({
            ...benefit,
            category,
            state: stateCode,
            stateName: state.name
          });
        }
      });
    });
  });
  
  return results;
};

/**
 * Get summary statistics
 */
export const getDatabaseStatistics = async () => {
  const database = await loadBenefitsDatabase();
  
  let totalBenefits = 0;
  let totalCategories = new Set();
  let benefitsByRating = {};
  
  Object.values(database).forEach(state => {
    Object.forEach(Object.entries(state.categories), ([category, benefits]) => {
      totalCategories.add(category);
      benefits.forEach(benefit => {
        totalBenefits++;
        const rating = benefit.minimumRating || 0;
        if (!benefitsByRating[rating]) {
          benefitsByRating[rating] = 0;
        }
        benefitsByRating[rating]++;
      });
    });
  });
  
  return {
    totalStates: Object.keys(database).length,
    totalBenefits,
    totalCategories: totalCategories.size,
    categories: Array.from(totalCategories).sort(),
    benefitsByMinimumRating: benefitsByRating,
    metadata: {
      generatedAt: new Date().toISOString(),
      dataSource: 'STATE_BENEFITS_DATABASE.md'
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
