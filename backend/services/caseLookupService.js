/**
 * Case Lookup Service
 * 
 * Provides access to CAVC precedential decisions for legal authority
 * in regulatory interpretation and benefit determinations.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, '../../knowledge');

let caseIndexCache = null;
let caseDetailsCache = {};

/**
 * Load case index from JSON
 */
const loadCaseIndex = async () => {
  if (!caseIndexCache) {
    const indexPath = path.join(KNOWLEDGE_BASE_DIR, 'cases_index.json');
    const content = await fs.readFile(indexPath, 'utf-8');
    caseIndexCache = JSON.parse(content);
  }
  return caseIndexCache;
};

/**
 * Load full case content from markdown file
 */
const loadCaseContent = async (filePath) => {
  if (caseDetailsCache[filePath]) {
    return caseDetailsCache[filePath];
  }
  
  const fullPath = path.join(KNOWLEDGE_BASE_DIR, filePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  caseDetailsCache[filePath] = content;
  return content;
};

/**
 * Get case by CAVC ID (e.g., CAVC-14-3611)
 */
export const getCaseById = async (caseId) => {
  const index = await loadCaseIndex();
  const caseData = index.find(c => c.caseId === caseId);
  
  if (!caseData) {
    return null;
  }
  
  return {
    ...caseData,
    url: `/${caseData.filePath}`
  };
};

/**
 * Get cases by year
 */
export const getCasesByYear = async (year) => {
  const index = await loadCaseIndex();
  const yearStr = String(year);
  const cases = index.filter(c => c.year === yearStr);
  
  return cases.map(c => ({
    ...c,
    url: `/${c.filePath}`
  }));
};

/**
 * Get all cases (for listing/search)
 */
export const getAllCases = async () => {
  const index = await loadCaseIndex();
  return index.map(c => ({
    ...c,
    url: `/${c.filePath}`
  }));
};

/**
 * Get case details including full content
 */
export const getCaseDetails = async (caseId) => {
  const caseMetadata = await getCaseById(caseId);
  
  if (!caseMetadata) {
    return null;
  }
  
  const content = await loadCaseContent(caseMetadata.filePath);
  
  return {
    ...caseMetadata,
    content,
    url: `/${caseMetadata.filePath}`,
    summary: extractCaseSummary(content)
  };
};

/**
 * Get cases related to specific topics
 */
export const getCasesByTopic = async (topic) => {
  const allCases = await getAllCases();
  const keywords = topic.toLowerCase().split(/\s+/);
  
  const matches = [];
  
  for (const caseData of allCases) {
    const content = await loadCaseContent(caseData.filePath);
    const contentLower = content.toLowerCase();
    
    const matchCount = keywords.filter(keyword => 
      contentLower.includes(keyword)
    ).length;
    
    if (matchCount > 0) {
      matches.push({
        ...caseData,
        relevance: matchCount / keywords.length,
        url: `/${caseData.filePath}`
      });
    }
  }
  
  // Sort by relevance
  return matches.sort((a, b) => b.relevance - a.relevance);
};

/**
 * Extract summary from case content
 */
const extractCaseSummary = (content) => {
  const lines = content.split('\n');
  const summary = lines
    .slice(0, 20)
    .filter(line => line.trim() && !line.startsWith('#'))
    .join(' ')
    .substring(0, 500)
    .trim();
  
  return summary + (summary.length === 500 ? '...' : '');
};

/**
 * Build regulatory+case cross-reference
 * Maps CFR citations to supporting case law
 */
export const buildRegulatoryReferences = async (cfrCitations) => {
  const allCases = await getAllCases();
  const references = {};
  
  for (const citation of cfrCitations) {
    const citationStr = citation.toLowerCase();
    const relatedCases = [];
    
    for (const caseData of allCases) {
      const content = await loadCaseContent(caseData.filePath);
      if (content.toLowerCase().includes(citationStr)) {
        relatedCases.push({
          ...caseData,
          url: `/${caseData.filePath}`
        });
      }
    }
    
    if (relatedCases.length > 0) {
      references[citation] = relatedCases;
    }
  }
  
  return references;
};

/**
 * Get case timeline (all cases organized by year)
 */
export const getCaseTimeline = async () => {
  const allCases = await getAllCases();
  const timeline = {};
  
  allCases.forEach(caseData => {
    if (!timeline[caseData.year]) {
      timeline[caseData.year] = [];
    }
    timeline[caseData.year].push(caseData);
  });
  
  // Sort years
  const sortedTimeline = {};
  Object.keys(timeline)
    .sort()
    .forEach(year => {
      sortedTimeline[year] = timeline[year];
    });
  
  return sortedTimeline;
};

/**
 * Search cases by text content
 */
export const searchCases = async (searchTerm) => {
  const allCases = await getAllCases();
  const results = [];
  const searchLower = searchTerm.toLowerCase();
  
  for (const caseData of allCases) {
    const content = await loadCaseContent(caseData.filePath);
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes(searchLower)) {
      // Count occurrences for relevance ranking
      let occurrences = 0;
      let index = 0;
      while ((index = contentLower.indexOf(searchLower, index)) !== -1) {
        occurrences++;
        index += searchLower.length;
      }
      
      results.push({
        ...caseData,
        relevance: occurrences,
        url: `/${caseData.filePath}`
      });
    }
  }
  
  // Sort by relevance
  return results.sort((a, b) => b.relevance - a.relevance);
};
