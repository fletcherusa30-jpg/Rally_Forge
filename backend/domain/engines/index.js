/**
 * backend/domain/engines/index.js
 *
 * Barrel export for consolidated domain layer engines.
 * These replace scattered engine implementations across the codebase.
 *
 * Usage:
 *   import { benefitsEngine, compensationEngine } from '../domain/engines/index.js';
 *   const result = await benefitsEngine.evaluate(veteran);
 */

export { default as benefitsEngine, BenefitsEngine } from './BenefitsEngine.js';
export { default as compensationEngine, CompensationEngine } from './CompensationEngine.js';
