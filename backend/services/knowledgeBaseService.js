/**
 * Knowledge Base Service
 * 
 * Provides unified access to Rally Forge's complete VA knowledge base:
 * - 38 CFR Part 3 (Disability Compensation Regulations)
 * - 38 CFR Part 4 (Rating Schedule & Diagnostic Codes)
 * - CAVC Cases (Precedential Legal Decisions)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, '../../knowledge');

// Cache for loaded knowledge base components
const cache = {
  part3: null,
  part4: null,
  part4DiagnosticCodes: null,
  cases: null,
  schema: null
};

function normalizeSectionTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().replace(/[.;:,]+$/, '');
}

function extractPart3SectionsFromRawDocument(rawDocument) {
  const pages = Array.isArray(rawDocument?.pages) ? rawDocument.pages : [];
  const sections = [];
  const seen = new Set();
  const sectionPattern = /§+\s*([0-9]+\.[0-9]+[a-z]?)\s+([^§\n]+?)(?=(?:\s§+\s*[0-9]+\.[0-9]+[a-z]?\s)|$)/g;

  for (const page of pages) {
    const rawText = String(page?.text || '').replace(/\s+/g, ' ').trim();
    if (!rawText) {
      continue;
    }

    let match;
    while ((match = sectionPattern.exec(rawText)) !== null) {
      const sectionNumber = `§${match[1]}`;
      if (seen.has(sectionNumber)) {
        continue;
      }

      sections.push({
        sectionNumber,
        title: normalizeSectionTitle(match[2]),
        partNumber: 3,
        rawText,
        paragraphs: [],
        authority: null,
        crossReferences: [],
        notes: [],
      });
      seen.add(sectionNumber);
    }
  }

  return sections;
}

/**
 * Load JSON file with caching
 */
const loadJSON = async (relativePath) => {
  const fullPath = path.join(KNOWLEDGE_BASE_DIR, relativePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
};

/**
 * Load 38 CFR Part 3 sections
 */
export const loadPart3 = async () => {
  if (!cache.part3) {
    try {
      const sections = await loadJSON('part3/sections.json');
      cache.part3 = Array.isArray(sections) ? sections : sections.sections || [];
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }

      const rawPart3 = await loadJSON('_raw_extraction/part3_raw.json');
      cache.part3 = extractPart3SectionsFromRawDocument(rawPart3);
    }
  }
  return cache.part3;
};

/**
 * Load 38 CFR Part 4 sections
 */
export const loadPart4 = async () => {
  if (!cache.part4) {
    const sections = await loadJSON('part4/sections.json');
    cache.part4 = Array.isArray(sections) ? sections : sections.sections || [];
  }
  return cache.part4;
};

/**
 * Load Part 4 diagnostic codes
 */
export const loadDiagnosticCodes = async () => {
  if (!cache.part4DiagnosticCodes) {
    cache.part4DiagnosticCodes = await loadJSON('part4/diagnostic_codes.json');
  }
  return cache.part4DiagnosticCodes;
};

/**
 * Load CAVC case index
 */
export const loadCases = async () => {
  if (!cache.cases) {
    cache.cases = await loadJSON('cases_index.json');
  }
  return cache.cases;
};

/**
 * Load knowledge base schema
 */
export const loadSchema = async () => {
  if (!cache.schema) {
    cache.schema = await loadJSON('knowledge_base_schema.json');
  }
  return cache.schema;
};

/**
 * Load complete knowledge base
 */
export const loadKnowledgeBase = async () => {
  const [part3, part4, diagnosticCodes, cases, schema] = await Promise.all([
    loadPart3(),
    loadPart4(),
    loadDiagnosticCodes(),
    loadCases(),
    loadSchema()
  ]);

  return {
    part3,
    part4,
    diagnosticCodes,
    cases,
    schema,
    stats: {
      part3Sections: part3.length,
      part4Sections: part4.length,
      diagnosticCodes: diagnosticCodes.length,
      totalCases: cases.length
    }
  };
};

/**
 * Case Lookup Service
 */
export class CaseLookupService {
  constructor(caseIndex) {
    this.cases = caseIndex || [];
  }

  /**
   * Get case by exact ID match
   */
  getCaseById(caseId) {
    const normalized = String(caseId || '').trim();
    return this.cases.find(c => c.caseId === normalized);
  }

  /**
   * Get all cases from a specific year
   */
  getCasesByYear(year) {
    const yearStr = String(year);
    return this.cases.filter(c => c.year === yearStr);
  }

  /**
   * Get case details with full path for loading
   */
  getCaseDetails(caseId) {
    const caseFile = this.getCaseById(caseId);
    if (!caseFile) return null;

    return {
      ...caseFile,
      url: `knowledge/${caseFile.filePath}`,
      resourcePath: caseFile.filePath,
      fullPath: path.join(KNOWLEDGE_BASE_DIR, caseFile.filePath)
    };
  }

  /**
   * List all available cases
   */
  getAllCases() {
    return this.cases;
  }

  /**
   * Search cases by name/title
   */
  searchCases(query) {
    const normalized = String(query || '').toLowerCase();
    if (!normalized) return [];

    return this.cases.filter(c => 
      c.caseId.toLowerCase().includes(normalized) ||
      c.fileName.toLowerCase().includes(normalized)
    );
  }

  /**
   * Load case file content
   */
  async loadCaseContent(caseId) {
    const caseDetails = this.getCaseDetails(caseId);
    if (!caseDetails) {
      throw new Error(`Case not found: ${caseId}`);
    }

    const content = await fs.readFile(caseDetails.fullPath, 'utf-8');
    return {
      ...caseDetails,
      content
    };
  }
}

/**
 * Part 3 Lookup Service
 */
export class Part3LookupService {
  constructor(sections) {
    this.sections = sections || [];
  }

  /**
   * Find section by section number
   */
  getSectionByNumber(sectionNumber) {
    const normalized = String(sectionNumber || '').replace(/\s+/g, '');
    return this.sections.find(s => 
      String(s.sectionNumber || '').replace(/\s+/g, '') === normalized
    );
  }

  /**
   * Search sections by title or content
   */
  searchSections(query) {
    const normalized = String(query || '').toLowerCase();
    if (!normalized) return [];

    return this.sections.filter(s => 
      (s.title || '').toLowerCase().includes(normalized) ||
      (s.sectionNumber || '').toLowerCase().includes(normalized) ||
      (s.rawText || '').toLowerCase().includes(normalized)
    );
  }

  /**
   * Get sections by topic (dependents, effective dates, etc.)
   */
  getSectionsByTopic(topic) {
    const topicMap = {
      'dependents': ['3.500', '3.501', '3.502', '3.503', '3.504', '3.505'],
      'effective_dates': ['3.400', '3.401', '3.402', '3.403'],
      'service_connection': ['3.300', '3.301', '3.302', '3.303', '3.304', '3.305', '3.306', '3.307', '3.308', '3.309'],
      'compensation_rates': ['3.10', '3.11', '3.12', '3.13', '3.14', '3.15']
    };

    const sectionNumbers = topicMap[topic] || [];
    return sectionNumbers.map(num => this.getSectionByNumber(`§${num}`)).filter(Boolean);
  }
}

/**
 * Part 4 Lookup Service
 */
export class Part4LookupService {
  constructor(sections, diagnosticCodes) {
    this.sections = sections || [];
    this.diagnosticCodes = diagnosticCodes || [];
  }

  /**
   * Find section by section number
   */
  getSectionByNumber(sectionNumber) {
    const normalized = String(sectionNumber || '').replace(/\s+/g, '');
    return this.sections.find(s => 
      String(s.sectionNumber || '').replace(/\s+/g, '') === normalized
    );
  }

  /**
   * Find diagnostic code
   */
  getDiagnosticCode(code) {
    const codeStr = String(code || '').trim();
    return this.diagnosticCodes.find(dc => String(dc.code) === codeStr);
  }

  /**
   * Search diagnostic codes by condition name or description
   */
  searchDiagnosticCodes(query) {
    const normalized = String(query || '').toLowerCase();
    if (!normalized) return [];

    return this.diagnosticCodes.filter(dc => 
      (dc.description || '').toLowerCase().includes(normalized) ||
      (dc.section || '').toLowerCase().includes(normalized) ||
      String(dc.code).includes(normalized)
    );
  }

  /**
   * Get diagnostic codes by body system
   */
  getDiagnosticCodesByBodySystem(bodySystem) {
    const normalized = String(bodySystem || '').toLowerCase();
    return this.diagnosticCodes.filter(dc => 
      (dc.bodySystem || '').toLowerCase() === normalized
    );
  }
}

/**
 * Unified Knowledge Base Search
 */
export class KnowledgeBaseSearch {
  constructor(knowledgeBase) {
    this.part3Service = new Part3LookupService(knowledgeBase.part3);
    this.part4Service = new Part4LookupService(knowledgeBase.part4, knowledgeBase.diagnosticCodes);
    this.caseService = new CaseLookupService(knowledgeBase.cases);
  }

  /**
   * Search across all knowledge base components
   */
  async searchAll(query) {
    const [part3Results, part4Results, caseResults] = await Promise.all([
      Promise.resolve(this.part3Service.searchSections(query)),
      Promise.resolve(this.part4Service.searchDiagnosticCodes(query)),
      Promise.resolve(this.caseService.searchCases(query))
    ]);

    return {
      query,
      results: {
        part3: part3Results.slice(0, 10),
        part4: part4Results.slice(0, 10),
        cases: caseResults.slice(0, 10)
      },
      totalResults: part3Results.length + part4Results.length + caseResults.length
    };
  }

  /**
   * Get related regulations and cases for a condition
   */
  async getConditionKnowledge(condition) {
    const diagnosticCodes = this.part4Service.searchDiagnosticCodes(condition);
    const part3Sections = this.part3Service.searchSections(condition);
    const cases = this.caseService.searchCases(condition);

    return {
      condition,
      diagnosticCodes: diagnosticCodes.slice(0, 5),
      regulations: part3Sections.slice(0, 5),
      cases: cases.slice(0, 5)
    };
  }
}

/**
 * Initialize knowledge base services
 */
export const initializeKnowledgeBase = async () => {
  const knowledgeBase = await loadKnowledgeBase();
  const searchService = new KnowledgeBaseSearch(knowledgeBase);

  return {
    knowledgeBase,
    searchService,
    part3Service: searchService.part3Service,
    part4Service: searchService.part4Service,
    caseService: searchService.caseService
  };
};

/**
 * Clear cache (useful for testing or updates)
 */
export const clearCache = () => {
  Object.keys(cache).forEach(key => {
    cache[key] = null;
  });
};
