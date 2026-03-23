import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BENEFIT_RULES_PATH = path.join(__dirname, '..', '..', 'knowledge', 'benefits', 'benefit-rules.json');
const STATE_BENEFITS_PATH = path.join(__dirname, '..', '..', 'resources', 'state-benefits.json');

let benefitCache = null;

function loadBenefitRules() {
  if (benefitCache) return benefitCache;

  let rules = [];
  let stateBenefits = {};

  try {
    const rulesRaw = fs.readFileSync(BENEFIT_RULES_PATH, 'utf8').replace(/^\uFEFF/, '');
    rules = JSON.parse(rulesRaw);
  } catch (e) {
    rules = [];
  }

  try {
    const stateRaw = fs.readFileSync(STATE_BENEFITS_PATH, 'utf8').replace(/^\uFEFF/, '');
    stateBenefits = JSON.parse(stateRaw);
  } catch (e) {
    stateBenefits = {};
  }

  benefitCache = {
    rules,
    stateBenefits,
    indexed: indexRules(rules),
  };

  return benefitCache;
}

function indexRules(rules) {
  const byType = new Map();
  const byEligibility = new Map();

  for (const rule of rules) {
    const type = String(rule.benefitType || '').trim();
    const eligKey = String(rule.eligibilityKey || '').trim();

    if (type) {
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(rule);
    }

    if (eligKey) {
      if (!byEligibility.has(eligKey)) byEligibility.set(eligKey, []);
      byEligibility.get(eligKey).push(rule);
    }
  }

  return { byType, byEligibility };
}

function validateBenefit(benefitInput = {}) {
  const result = {
    isValid: false,
    errors: [],
    warnings: [],
    normalizedBenefit: null,
  };

  const type = String(benefitInput.type || '').trim().toLowerCase();
  const eligibilityStatus = String(benefitInput.eligibilityStatus || '').trim().toUpperCase();
  const veteranStatus = String(benefitInput.veteranStatus || '').trim().toUpperCase();

  if (!type) {
    result.errors.push('benefit type is required');
    return result;
  }

  if (!eligibilityStatus) {
    result.errors.push('eligibility status is required');
    return result;
  }

  const rules = loadBenefitRules();
  const matchingRules = rules.indexed.byType.get(type) || [];

  if (matchingRules.length === 0) {
    result.errors.push(`unknown benefit type: ${type}`);
    return result;
  }

  const validStatuses = ['ELIGIBLE', 'INELIGIBLE', 'PENDING', 'RESTRICTED'];
  if (!validStatuses.includes(eligibilityStatus)) {
    result.errors.push(`invalid eligibility status: ${eligibilityStatus}. must be one of: ${validStatuses.join(', ')}`);
    return result;
  }

  const matchedRule = matchingRules.find((r) => {
    const ruleStatus = String(r.eligibilityStatus || '').trim().toUpperCase();
    return ruleStatus === eligibilityStatus;
  });

  if (!matchedRule) {
    result.warnings.push(`no specific rule found for ${type}/${eligibilityStatus}`);
  }

  result.normalizedBenefit = {
    type,
    eligibilityStatus,
    veteranStatus,
    rule: matchedRule || null,
    appliedAt: new Date().toISOString(),
  };

  result.isValid = true;
  return result;
}

function validateBenefitList(benefitList = []) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    normalizedBenefits: [],
  };

  if (!Array.isArray(benefitList)) {
    result.isValid = false;
    result.errors.push('benefit list must be an array');
    return result;
  }

  const seen = new Set();

  benefitList.forEach((benefit, index) => {
    const validation = validateBenefit(benefit);

    if (!validation.isValid) {
      result.isValid = false;
      validation.errors.forEach((error) => {
        result.errors.push({ index, error });
      });
      return;
    }

    const normalized = validation.normalizedBenefit;
    const dupKey = `${normalized.type}::${normalized.eligibilityStatus}`;

    if (seen.has(dupKey)) {
      result.isValid = false;
      result.errors.push({ index, error: 'duplicate benefit entry in list' });
      return;
    }

    seen.add(dupKey);
    validation.warnings.forEach((warning) => {
      result.warnings.push({ index, warning });
    });

    result.normalizedBenefits.push(normalized);
  });

  return result;
}

function clearBenefitCache() {
  benefitCache = null;
}

export {
  clearBenefitCache,
  loadBenefitRules,
  validateBenefit,
  validateBenefitList,
};
