/**
 * backend/domain/engines/BenefitsEngine.js
 *
 * Consolidated benefits evaluation engine.
 * Wraps backend/engine/benefits/benefitsEngine.js with structured logging and error handling.
 *
 * This is the domain layer entry point for benefits calculation.
 * Consolidates duplicated logic from the former monolithic state benefits layer
 * and the legacy service facade retained only for compatibility during migration.
 *
 * Implementation: Delegates to backend/engine/benefits/benefitsEngine.js for orchestration.
 */

import { computeBenefits } from '../../engine/benefits/benefitsEngine.js';
import { createLogger } from '../../core/logging/logger.js';

const log = createLogger('benefits-engine');

export class BenefitsEngine {
  /**
   * Full benefits evaluation for a veteran.
   * Computes eligibility for federal, state, combat, exposure, rating, retirement.
   *
   * @param {object} veteran  Onboarding result / profile
   * @param {object} options  Optional { logger, requestId }
   * @returns {Promise<object>}  Comprehensive benefits evaluation
   */
  async evaluate(veteran, options = {}) {
    if (!veteran) {
      log.warn('Benefits evaluation skipped: no veteran provided');
      return this._emptyResult();
    }

    const startTime = Date.now();

    try {
      const results = await computeBenefits(veteran, {
        logger: options.logger || log,
        requestId: options.requestId,
      });

      const totalEligible = [
        results.federal?.items?.length,
        results.state?.items?.length,
        results.combat?.items?.length,
        results.exposure?.items?.length,
        results.rating?.items?.length,
        results.retirement?.items?.length,
      ].reduce((sum, n) => sum + (n ?? 0), 0);

      const response = {
        veteranId: veteran.id,
        evaluatedAt: results.metadata?.computedAt || new Date().toISOString(),
        results,
        totalEligible,
        evaluationMs: Date.now() - startTime,
      };

      log.info('Benefits evaluated', {
        id: veteran.id,
        totalEligible,
        time: response.evaluationMs,
      });

      return response;
    } catch (err) {
      log.error('Benefits evaluation failed', {
        id: veteran.id,
        error: err.message,
        time: Date.now() - startTime,
      });
      return {
        veteranId: veteran.id,
        evaluatedAt: new Date().toISOString(),
        results: this._emptyResults(),
        totalEligible: 0,
        error: err.message,
        evaluationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Legacy compatibility wrapper for state-only callers.
   * Returns the state section payload shape used by previous services.
   *
   * @param {object} veteran
   * @param {object} options
   * @returns {Promise<object>}
   */
  async evaluateStateOnly(veteran, options = {}) {
    const full = await this.evaluate(veteran, options);
    return full?.results?.state || { category: 'state', items: [], notes: [] };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _emptyResult() {
    return {
      veteranId: null,
      evaluatedAt: new Date().toISOString(),
      results: this._emptyResults(),
      totalEligible: 0,
    };
  }

  _emptyResults() {
    return {
      federal: { category: 'federal', items: [], notes: [] },
      state: { category: 'state', items: [], notes: [] },
      combat: { category: 'combat', items: [], notes: [] },
      exposure: { category: 'exposure', items: [], notes: [] },
      rating: { category: 'rating', items: [], notes: [] },
      retirement: { category: 'retirement', items: [], notes: [] },
      metadata: {
        computedAt: new Date().toISOString(),
        ruleVersions: {},
      },
    };
  }
}

export default new BenefitsEngine();
