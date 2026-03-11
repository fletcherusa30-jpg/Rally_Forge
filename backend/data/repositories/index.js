/**
 * backend/data/repositories/index.js
 *
 * Barrel export for the repository layer.
 * Consumers import singletons from here.
 *
 * Usage:
 *   import veteranRepo from '../data/repositories/index.js';
 *   import { caseRepo, benefitsRepo } from '../data/repositories/index.js';
 */

export { VeteranRepository }   from './VeteranRepository.js';
export { CaseRepository }      from './CaseRepository.js';
export { BenefitsRepository }  from './BenefitsRepository.js';
export { STRSRepository }      from './STRSRepository.js';

// Pre-constructed singletons (preferred for service injection)
export { default as veteranRepo }   from './VeteranRepository.js';
export { default as caseRepo }      from './CaseRepository.js';
export { default as benefitsRepo }  from './BenefitsRepository.js';
export { default as strsRepo }      from './STRSRepository.js';
