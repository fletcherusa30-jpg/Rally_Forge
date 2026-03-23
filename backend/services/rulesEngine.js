/**
 * Rules Engine - Benefit Eligibility and Logic
 * Executes business rules for veteran benefit eligibility determination
 */

const ruleRegistry = new Map();

function registerRule(ruleId, ruleDefinition = {}) {
  if (!ruleId || !ruleDefinition.evaluate) {
    throw new Error('Rule must have ID and evaluate function');
  }

  const normalized = {
    id: String(ruleId).trim(),
    name: String(ruleDefinition.name || ruleId).trim(),
    description: String(ruleDefinition.description || '').trim(),
    category: String(ruleDefinition.category || 'general').trim(),
    priority: Number(ruleDefinition.priority) || 0,
    evaluate: ruleDefinition.evaluate,
    preconditions: Array.isArray(ruleDefinition.preconditions) ? ruleDefinition.preconditions : [],
    actions: ruleDefinition.actions || {},
  };

  ruleRegistry.set(normalized.id, normalized);
  return normalized;
}

function evaluateRule(ruleId, context = {}) {
  const rule = ruleRegistry.get(ruleId);

  if (!rule) {
    return {
      ruleId,
      executed: false,
      passed: false,
      errors: [`rule not found: ${ruleId}`],
      result: null,
    };
  }

  try {
    const preconditionsMet = rule.preconditions.every((precond) => {
      if (typeof precond === 'function') return precond(context);
      return true;
    });

    if (!preconditionsMet) {
      return {
        ruleId,
        executed: false,
        passed: false,
        errors: ['preconditions not met'],
        result: null,
      };
    }

    const result = rule.evaluate(context);

    return {
      ruleId,
      executed: true,
      passed: Boolean(result.passed),
      errors: result.errors || [],
      warnings: result.warnings || [],
      result: result.data || null,
      appliedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ruleId,
      executed: false,
      passed: false,
      errors: [`execution error: ${e.message}`],
      result: null,
    };
  }
}

function evaluateRuleChain(ruleIds = [], context = {}) {
  const results = [];
  let allPassed = true;
  const allErrors = [];

  for (const ruleId of ruleIds) {
    const result = evaluateRule(ruleId, context);
    results.push(result);

    if (!result.passed) {
      allPassed = false;
    }

    if (result.errors.length > 0) {
      allErrors.push(...result.errors);
    }
  }

  return {
    chainPassed: allPassed && allErrors.length === 0,
    rulResults: results,
    allErrors,
    evaluatedAt: new Date().toISOString(),
  };
}

function listRules(category = null) {
  const rules = Array.from(ruleRegistry.values());
  if (category) {
    const cat = String(category).toLowerCase();
    return rules.filter((r) => r.category.toLowerCase() === cat);
  }
  return rules.sort((a, b) => b.priority - a.priority);
}

function clearRuleRegistry() {
  ruleRegistry.clear();
}

// Pre-register common eligibility rules
function initializeCommonRules() {
  registerRule('check-veteran-status', {
    name: 'Check Veteran Status',
    description: 'Verify veteran meets basic eligibility criteria',
    category: 'veteran-status',
    priority: 100,
    preconditions: [(ctx) => ctx.veteranId && ctx.serviceRecord],
    evaluate: (context) => {
      if (!context.serviceRecord || !context.serviceRecord.honorableDischarge) {
        return {
          passed: false,
          errors: ['veteran must have honorable discharge'],
        };
      }
      return { passed: true, data: { statusVerified: true } };
    },
  });

  registerRule('check-service-connection', {
    name: 'Check Service Connection',
    description: 'Verify condition is connected to military service',
    category: 'service-connection',
    priority: 90,
    evaluate: (context) => {
      if (!context.condition || !context.condition.serviceConnected) {
        return {
          passed: false,
          errors: ['condition not service-connected'],
        };
      }
      return { passed: true, data: { serviceConnected: true } };
    },
  });

  registerRule('check-rating-threshold', {
    name: 'Check Rating Threshold',
    description: 'Verify disability rating meets benefit threshold',
    category: 'rating',
    priority: 80,
    evaluate: (context) => {
      const minRating = context.minimumRating || 10;
      const veteranRating = context.veteranRating || 0;

      if (veteranRating < minRating) {
        return {
          passed: false,
          errors: [`rating ${veteranRating}% below threshold ${minRating}%`],
        };
      }

      return {
        passed: true,
        data: { ratingMeetsThreshold: true, rating: veteranRating },
      };
    },
  });

  registerRule('check-residency', {
    name: 'Check Residency',
    description: 'Verify residency meets benefit requirements',
    category: 'residency',
    priority: 70,
    evaluate: (context) => {
      const residency = String(context.residency || '').toUpperCase();
      const eligible = ['US', 'US_TERRITORY', 'US_FOREIGN_SERVICE'];

      if (!eligible.includes(residency)) {
        return {
          passed: false,
          errors: [`residency ${residency} not eligible`],
        };
      }

      return {
        passed: true,
        data: { residencyEligible: true, residency },
      };
    },
  });
}

initializeCommonRules();

export {
  clearRuleRegistry,
  evaluateRule,
  evaluateRuleChain,
  initializeCommonRules,
  listRules,
  registerRule,
};
