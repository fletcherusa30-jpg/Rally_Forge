/**
 * backend/domain/index.js
 *
 * Barrel export for the entire domain layer.
 * The domain layer orchestrates all business logic and consolidates duplicated patterns.
 *
 * Usage:
 *   import { benefitsEngine, veteranRepo } from '../domain/index.js';
 *   import { caseRepo, benefitsRepo } from '../domain/index.js';
 */

// Engines
export { default as benefitsEngine, BenefitsEngine } from './engines/BenefitsEngine.js';
export { default as compensationEngine, CompensationEngine } from './engines/CompensationEngine.js';

// Repositories (data access)
export { default as veteranRepo, VeteranRepository } from '../data/repositories/VeteranRepository.js';
export { default as caseRepo, CaseRepository } from '../data/repositories/CaseRepository.js';
export { default as benefitsRepo, BenefitsRepository } from '../data/repositories/BenefitsRepository.js';
export { default as strsRepo, STRSRepository } from '../data/repositories/STRSRepository.js';

// Data Access Layer
export {
  FileSystemDataSource,
  MongoDataSource,
  PostgresDataSource,
  cacheSet,
  cacheGet,
  cacheDel,
  cacheWrap,
} from '../data/access/index.js';
