/**
 * extractClaimantInfo.js
 * 
 * Extracts claimant/veteran identification information from VA Rating Decision text.
 * 
 * Extracted Fields:
 * - fileNumber: VA file number for the claim
 * - claimantName: Full name of the claimant/veteran
 * - veteranSSN: Social Security Number (if visible, often redacted)
 * - decisionControl: Decision control number or reference ID
 * - regionalOffice: VA Regional Office that processed the claim
 * - phoneNumber: Contact phone number (if present)
 * 
 * Impact: CRITICAL - Enables record linking, audit trails, duplicate detection
 * Author: Rally Forge Scanner Enhancement - March 2026
 */

/**
 * Extract claimant identification information
 * @param {string} normalizedText - Preprocessed decision text
 * @returns {Object} Claimant identification details
 */
export function extractClaimantInfo(normalizedText) {
  const result = {
    fileNumber: null,
    claimantName: null,
    veteranSSN: null,
    decisionControl: null,
    regionalOffice: null,
    phoneNumber: null,
    confidence: {
      fileNumber: 0,
      claimantName: 0,
      overall: 0
    }
  };

  // Extract VA File Number (highest priority identifier)
  result.fileNumber = extractFileNumber(normalizedText);
  result.confidence.fileNumber = result.fileNumber ? 95 : 0;

  // Extract claimant/veteran name
  const nameData = extractClaimantName(normalizedText);
  result.claimantName = nameData.name;
  result.confidence.claimantName = nameData.confidence;

  // Extract SSN (often redacted with XXX-XX-XXXX)
  result.veteranSSN = extractSSN(normalizedText);

  // Extract decision control number
  result.decisionControl = extractDecisionControl(normalizedText);

  // Extract regional office
  result.regionalOffice = extractRegionalOffice(normalizedText);

  // Extract phone number (optional)
  result.phoneNumber = extractPhoneNumber(normalizedText);

  // Calculate overall confidence
  const confidenceScores = [
    result.confidence.fileNumber,
    result.confidence.claimantName
  ].filter(score => score > 0);
  
  result.confidence.overall = confidenceScores.length > 0
    ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
    : 0;

  return result;
}

/**
 * Extract VA file number using multiple pattern variations
 */
function extractFileNumber(text) {
  const patterns = [
    // Standard format: "VA FILE 12345678"
    /VA\s+FILE\s+(?:NUMBER|NO\.?|#)?\s*[:\s]*(\d{7,9})/i,
    
    // Alternative: "File Number: 12345678"
    /File\s+Number\s*[:\s]+(\d{7,9})/i,
    
    // Legacy format: "Veterans Affairs File Number: 12345678"
    /Veterans?\s+Affairs\s+File\s+Number\s*[:\s]+(\d{7,9})/i,
    
    // Compact: "C-File: 12345678"
    /C-File\s*[:\s]+(\d{7,9})/i,
    
    // Header format: "VETERAN FILE NUMBER 12345678"
    /VETERAN\s+FILE\s+NUMBER\s*[:\s]*(\d{7,9})/i,
    
    // Claim number (sometimes used interchangeably)
    /Claim\s+(?:Number|No\.?|#)\s*[:\s]*(\d{7,9})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const fileNum = match[1];
      // Validate: file numbers are typically 7-9 digits
      if (fileNum.length >= 7 && fileNum.length <= 9) {
        return fileNum;
      }
    }
  }

  return null;
}

/**
 * Extract claimant/veteran name
 */
function extractClaimantName(text) {
  const result = { name: null, confidence: 0 };

  const patterns = [
    // Header format: "DECISION LETTER FOR: SMITH, JOHN A"
    /DECISION\s+LETTER\s+FOR\s*[:\s]+([A-Z][A-Z\s,\.'-]+?)(?:\n|$|\s{2,})/i,
    
    // Standard: "Claimant: SMITH, JOHN ANDREW"
    /Claimant\s*[:\s]+([A-Z][A-Z\s,\.'-]+?)(?:\n|$|\s{2,})/i,
    
    // Veteran format: "Veteran: SMITH, JOHN A."
    /Veteran\s*[:\s]+([A-Z][A-Z\s,\.'-]+?)(?:\n|$|\s{2,})/i,
    
    // Name: format at document header
    /^Name\s*[:\s]+([A-Z][A-Z\s,\.'-]+?)(?:\n|$|\s{2,})/im,
    
    // In re: legal format
    /In\s+(?:the\s+matter\s+of|re)\s*[:\s]*([A-Z][A-Z\s,\.'-]+?)(?:\n|$|,)/i,
    
    // Dear format: "Dear Mr./Ms. SMITH"
    /Dear\s+(?:Mr\.|Ms\.|Mrs\.|Veteran)\s+([A-Z][A-Z\s,\.'-]+?)(?:\n|$|,)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = text.match(pattern);
    
    if (match) {
      let name = match[1].trim();
      
      // Clean up name
      name = cleanName(name);
      
      // Validate name (must have at least 2 parts, reasonable length)
      if (isValidName(name)) {
        result.name = name;
        // Higher confidence for earlier patterns (more explicit)
        result.confidence = 95 - (i * 10);
        break;
      }
    }
  }

  return result;
}

/**
 * Clean extracted name
 */
function cleanName(name) {
  return name
    .replace(/\s{2,}/g, ' ')           // Collapse multiple spaces
    .replace(/[^\w\s,\.'-]/g, '')      // Remove invalid characters
    .replace(/\.{2,}/g, '.')           // Collapse multiple periods
    .trim();
}

/**
 * Validate name structure
 */
function isValidName(name) {
  // Must have at least 2 parts (Last, First or First Last)
  const parts = name.split(/[\s,]+/).filter(p => p.length > 0);
  if (parts.length < 2) return false;
  
  // Name length constraints (2-60 characters reasonable)
  if (name.length < 2 || name.length > 60) return false;
  
  // Each part must be at least 1 character
  if (parts.some(p => p.length < 1)) return false;
  
  // Reject common false positives
  const invalidNames = ['DEPARTMENT OF', 'VETERANS AFFAIRS', 'UNITED STATES', 'REGIONAL OFFICE'];
  if (invalidNames.some(invalid => name.toUpperCase().includes(invalid))) {
    return false;
  }
  
  return true;
}

/**
 * Extract SSN (often redacted)
 */
function extractSSN(text) {
  const patterns = [
    // Full SSN (rare, usually redacted)
    /SSN\s*[:\s]+(\d{3}-\d{2}-\d{4})/i,
    
    // Social Security format
    /Social\s+Security\s+(?:Number|No\.?)\s*[:\s]+(\d{3}-\d{2}-\d{4})/i,
    
    // Redacted format (useful to know it exists even if redacted)
    /SSN\s*[:\s]+(XXX-XX-\d{4}|XXX-XX-XXXX)/i,
    
    // Last 4 digits only
    /SSN\s+(?:ending\s+in|last\s+four)\s*[:\s]+(\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract decision control number or reference ID
 */
function extractDecisionControl(text) {
  const patterns = [
    // Standard: "Decision Control Number: ABC123456"
    /Decision\s+Control\s+(?:Number|No\.?)\s*[:\s]+([A-Z0-9\s-]+?)(?:\n|$|\s{2,})/i,
    
    // Alternative: "Control Number: 12345678"
    /Control\s+(?:Number|No\.?|#)\s*[:\s]+([A-Z0-9\s-]+?)(?:\n|$|\s{2,})/i,
    
    // Reference: "Reference: VA2024-00123456"
    /Reference\s*[:\s]+(VA\d{4}-\d{5,})/i,
    
    // Case number
    /Case\s+(?:Number|No\.?|#)\s*[:\s]+([A-Z0-9\s-]+?)(?:\n|$|\s{2,})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const controlNum = match[1].trim();
      // Validate: control numbers typically 6-20 alphanumeric characters
      if (controlNum.length >= 6 && controlNum.length <= 20) {
        return controlNum;
      }
    }
  }

  return null;
}

/**
 * Extract VA Regional Office
 */
function extractRegionalOffice(text) {
  const patterns = [
    // Standard header format
    /Department\s+of\s+Veterans\s+Affairs[\s\S]{0,50}?(?:VA\s+)?Regional\s+Office\s*[:\s]*([A-Z][A-Za-z\s,]+?)(?:\n|$)/i,
    
    // Simple format: "Regional Office: St. Paul, MN"
    /Regional\s+Office\s*[:\s]+([A-Z][A-Za-z\s,\.]+?)(?:\n|$|\s{2,})/i,
    
    // RO abbreviation: "RO: St. Paul"
    /\bRO\s*[:\s]+([A-Z][A-Za-z\s,\.]+?)(?:\n|$|\s{2,})/i,
    
    // Location in header
    /VA\s+Regional\s+Office\s+-\s+([A-Z][A-Za-z\s,\.]+?)(?:\n|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let office = match[1].trim();
      
      // Clean office name
      office = office
        .replace(/\s{2,}/g, ' ')
        .replace(/[^\w\s,\.-]/g, '')
        .trim();
      
      // Validate (reasonable length)
      if (office.length >= 3 && office.length <= 50) {
        return office;
      }
    }
  }

  return null;
}

/**
 * Extract phone number (optional)
 */
function extractPhoneNumber(text) {
  const patterns = [
    // Standard format with parentheses
    /Phone\s*[:\s]+(\(\d{3}\)\s*\d{3}-\d{4})/i,
    
    // Dash format
    /Phone\s*[:\s]+(\d{3}-\d{3}-\d{4})/i,
    
    // Dot format
    /Phone\s*[:\s]+(\d{3}\.\d{3}\.\d{4})/i,
    
    // Contact number
    /Contact.*?(\d{3}-\d{3}-\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Default export for direct import
 */
export default extractClaimantInfo;
