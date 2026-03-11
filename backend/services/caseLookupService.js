/**
 * Case Lookup Service
 * 
 * Provides access to CAVC precedential decisions for legal authority
 * in regulatory interpretation and benefit determinations.
 */

import { caseRepo } from '../domain/index.js';

/**
 * Get case by CAVC ID (e.g., CAVC-14-3611)
 */
export const getCaseById = async (caseId) => {
  return caseRepo.findById(caseId);
};

/**
 * Get cases by year
 */
export const getCasesByYear = async (year) => {
  return caseRepo.findByYear(year);
};

/**
 * Get all cases (for listing/search)
 */
export const getAllCases = async () => {
  const cases = await caseRepo.findAll();
  return cases.map(c => ({ ...c, url: `/${c.filePath}` }));
};

/**
 * Get case details including full content
 */
export const getCaseDetails = async (caseId) => {
  const caseMetadata = await getCaseById(caseId);
  
  if (!caseMetadata) {
    return null;
  }
  
  const content = await caseRepo.getCaseContent(caseId);
  
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
    const content = await caseRepo.getCaseContent(caseData.caseId);
    const contentLower = content.toLowerCase();

    const matchCount = keywords.filter((keyword) =>
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
      const content = await caseRepo.getCaseContent(caseData.caseId);
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
  const timeline = await caseRepo.getTimeline();
  const sortedTimeline = {};
  Object.keys(timeline)
    .sort()
    .forEach((year) => {
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
    const content = await caseRepo.getCaseContent(caseData.caseId);
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
