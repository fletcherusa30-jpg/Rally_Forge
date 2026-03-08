/**
 * extractTDIU.js
 * 
 * Extracts Total Disability based on Individual Unemployability (TDIU) information
 * from VA Rating Decision text.
 * 
 * TDIU (38 CFR §4.16) allows veterans to be compensated at the 100% rate when:
 * - Schedular: Unable to secure substantial gainful employment due to service-connected disabilities
 * - Extraschedular: Special circumstances warrant TDIU despite not meeting schedular criteria
 * 
 * This often results in $1000+/month additional compensation beyond schedular rating.
 * 
 * Extracted Fields:
 * - isGranted: Whether TDIU has been granted
 * - effectiveDate: When TDIU compensation begins
 * - type: schedular, extraschedular, or schedular-with-consideration
 * - basisRating: The disability rating percentage on which TDIU is based
 * - unemployabilityReason: Explanation of why veteran is unemployable
 * - occupationBefore: Veteran's prior occupation (if stated)
 * - specificReasons: Array of specific unemployability factors
 * 
 * Impact: CRITICAL - Affects 30%+ of rated veterans, $1000+/month compensation impact
 * Author: Rally Forge Scanner Enhancement - March 2026
 */

/**
 * Extract TDIU information from decision text
 * @param {string} normalizedText - Preprocessed decision text
 * @returns {Object} TDIU award details
 */
export function extractTDIU(normalizedText) {
  const result = {
    isGranted: false,
    effectiveDate: null,
    type: null,  // 'schedular' | 'extraschedular' | 'schedular-with-consideration'
    basisRating: null,
    unemployabilityReason: null,
    occupationBefore: null,
    specificReasons: [],
    formUsed: null,  // e.g., "VA Form 21-8940"
    confidence: {
      overall: 0,
      effectiveDate: 0,
      type: 0
    }
  };

  // PASS 1: Look for explicit TDIU grant statement
  const explicitGrant = extractExplicitTDIUGrant(normalizedText);
  if (explicitGrant.found) {
    Object.assign(result, explicitGrant.data);
    result.isGranted = true;
    enrichSupplementalTDIUFields(result, normalizedText);
    result.confidence = calculateTDIUConfidence(result, normalizedText, 'explicit');
    return result;
  }

  // PASS 2: Look for TDIU with narrative/reason
  const narrativeGrant = extractNarrativeTDIU(normalizedText);
  if (narrativeGrant.found) {
    Object.assign(result, narrativeGrant.data);
    result.isGranted = true;
    enrichSupplementalTDIUFields(result, normalizedText);
    result.confidence = calculateTDIUConfidence(result, normalizedText, 'narrative');
    return result;
  }

  // PASS 3: Look for individual unemployability language
  const unemployabilityGrant = extractUnemployabilityGrant(normalizedText);
  if (unemployabilityGrant.found) {
    Object.assign(result, unemployabilityGrant.data);
    result.isGranted = true;
    enrichSupplementalTDIUFields(result, normalizedText);
    result.confidence = calculateTDIUConfidence(result, normalizedText, 'unemployability');
    return result;
  }

  // PASS 4: Denied TDIU check
  const denied = extractTDIUDenial(normalizedText);
  if (denied.found) {
    result.isGranted = false;
    result.unemployabilityReason = denied.reason;
    enrichSupplementalTDIUFields(result, normalizedText);
    result.confidence = calculateTDIUConfidence(result, normalizedText, 'denied');
    return result;
  }

  // PASS 5: Fallback - keyword presence indicates possible TDIU
  const keywords = extractTDIUKeywords(normalizedText);
  if (keywords.found) {
    result.isGranted = false;  // Unclear - don't assume granted
    result.unemployabilityReason = 'TDIU mentioned but status unclear - manual review required';
    enrichSupplementalTDIUFields(result, normalizedText);
    result.confidence = calculateTDIUConfidence(result, normalizedText, 'keyword');
  }

  return result;
}

function enrichSupplementalTDIUFields(result, normalizedText) {
  if (!Array.isArray(result.specificReasons) || result.specificReasons.length === 0) {
    result.specificReasons = extractSpecificReasons(normalizedText);
  }

  if (!result.occupationBefore) {
    result.occupationBefore = extractPriorOccupation(normalizedText);
  }

  if (!result.formUsed) {
    result.formUsed = extractTDIUForm(normalizedText);
  }
}

function calculateTDIUConfidence(result, text, mode) {
  let overall = 0;

  const modeWeights = {
    explicit: 92,
    narrative: 82,
    unemployability: 74,
    denied: 86,
    keyword: 35
  };

  overall = modeWeights[mode] || 25;

  const effectiveDate = result.effectiveDate || '';
  const hasDate = /\d{1,2}\/\d{1,2}\/\d{4}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}/.test(effectiveDate);
  const effectiveDateScore = hasDate ? 95 : 0;

  if (result.type === 'extraschedular') {
    overall += 2;
  }

  if ((result.specificReasons || []).length > 0) {
    overall += 3;
  }

  if (result.formUsed) {
    overall += 2;
  }

  if (/manual review required/i.test(result.unemployabilityReason || '')) {
    overall = Math.min(overall, 45);
  }

  if (text && /\bTDIU\b|Individual\s+Unemployability/i.test(text)) {
    overall += 1;
  }

  overall = Math.max(0, Math.min(99, Math.round(overall)));

  const typeScore = result.type ? 85 : (mode === 'keyword' ? 20 : 55);

  return {
    overall,
    effectiveDate: effectiveDateScore,
    type: typeScore
  };
}

/**
 * PASS 1: Extract explicit TDIU grant
 * Patterns: "entitlement to TDIU", "granted TDIU", "approved for individual unemployability"
 */
function extractExplicitTDIUGrant(text) {
  const patterns = [
    // "Entitlement to TDIU is granted effective..."
    /(?:Entitlement\s+to|We\s+(?:grant|approve|award))\s+(?:Total\s+Disability.*?)?(?:Individual\s+)?Unemployability.*?effective\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    
    // "TDIU is granted effective date of..."
    /TDIU\s+is\s+(?:granted|approved|awarded).*?(?:effective|date\s+of)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    
    // "Individual Unemployability (TDIU) approved, effective..."
    /Individual\s+Unemployability\s+\(TDIU\)\s+(?:granted|approved|awarded).*?effective\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    
    // "Total disability rating based on individual unemployability effective..."
    /Total\s+disability.*?(?:based\s+on|due\s+to)\s+[Ii]ndividual\s+[Uu]nemployability.*?effective\s+(\w+\s+\d{1,2},?\s+\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        found: true,
        data: {
          effectiveDate: match[1],
          type: 'schedular',  // Default assumption
          confidence: { effectiveDate: 95, type: 60 }
        }
      };
    }
  }

  return { found: false };
}

/**
 * PASS 2: Extract TDIU from narrative with reason
 * Includes context about why unemployability was granted
 */
function extractNarrativeTDIU(text) {
  // Pattern: Look for unemployability determination followed by effective date within 500 chars
  const pattern = /(?:Individual\s+)?[Uu]nemployab(?:ility|le)[\s\S]{0,500}?(?:effective|award(?:ed)?|from|dated)\s+(\w+\s+\d{1,2},?\s+\d{4})/i;
  const match = text.match(pattern);
  
  if (match) {
    const fullContext = match[0];
    const effectiveDate = match[1];
    
    // Try to extract reason from context
    const reason = extractUnemployabilityReason(fullContext);
    
    // Determine type (schedular vs extraschedular)
    const type = detectTDIUType(fullContext);
    
    return {
      found: true,
      data: {
        effectiveDate,
        unemployabilityReason: reason,
        type,
        confidence: { effectiveDate: 85, type: 70 }
      }
    };
  }

  return { found: false };
}

/**
 * PASS 3: Extract from unemployability grant language
 */
function extractUnemployabilityGrant(text) {
  const patterns = [
    // "We have determined you cannot secure substantial gainful employment"
    /(?:We\s+have\s+determined|The\s+(?:evidence|record)\s+shows).*?cannot\s+secure\s+substantial\s+gainful\s+employment[\s\S]{0,300}?(?:effective|from)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    
    // "Unemployability rating effective..."
    /Unemployability\s+rating.*?effective\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    
    // "Cannot work due to service-connected disabilities"
    /Cannot\s+(?:work|be\s+employed).*?(?:due\s+to|because\s+of)\s+service-connected.*?effective\s+(\w+\s+\d{1,2},?\s+\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const fullContext = match[0];
      const effectiveDate = match[1];
      const reason = extractUnemployabilityReason(fullContext);
      
      return {
        found: true,
        data: {
          effectiveDate,
          unemployabilityReason: reason || fullContext.substring(0, 200),
          type: 'schedular',
          confidence: { effectiveDate: 80, type: 65 }
        }
      };
    }
  }

  return { found: false };
}

/**
 * PASS 4: Extract TDIU denial
 */
function extractTDIUDenial(text) {
  const patterns = [
    // Explicit denial
    /(?:Entitlement\s+to|Claim\s+for)\s+(?:Total\s+Disability.*?)?(?:Individual\s+)?Unemployability\s+is\s+denied/i,
    
    // "TDIU is denied because..."
    /TDIU\s+is\s+denied.*?(?:because|as|since)\s+([\s\S]{0,200}?)(?:\n\n|$)/i,
    
    // "Individual unemployability denied"
    /Individual\s+[Uu]nemployab(?:ility|le)\s+(?:is\s+)?denied/i,
    
    // "Not entitled to unemployability"
    /Not\s+entitled\s+to.*?[Uu]nemployab(?:ility|le)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const reason = match[1] || 'Denied - see decision narrative for details';
      return {
        found: true,
        reason
      };
    }
  }

  return { found: false };
}

/**
 * PASS 5: Keyword detection (low confidence fallback)
 */
function extractTDIUKeywords(text) {
  const keywords = [
    /\bTDIU\b/i,
    /Individual\s+Unemployability/i,
    /VA\s+Form\s+21-8940/i,
    /substantially\s+gainful\s+employment/i
  ];

  const found = keywords.some(pattern => pattern.test(text));
  
  return { found };
}

/**
 * Extract reason for unemployability from context
 */
function extractUnemployabilityReason(context) {
  // Look for common reason patterns
  const reasonPatterns = [
    // "because of [reason]"
    /because\s+(?:of\s+)?(.+?)(?:\.|effective|$)/i,
    
    // "due to [reason]"
    /due\s+to\s+(.+?)(?:\.|effective|$)/i,
    
    // "as follows: [reason]"
    /as\s+follows\s*[:\s]+(.+?)(?:\.|effective|$)/i,
    
    // "cannot [action] because [reason]"
    /cannot\s+.+?\s+because\s+(.+?)(?:\.|effective|$)/i
  ];

  for (const pattern of reasonPatterns) {
    const match = context.match(pattern);
    if (match) {
      let reason = match[1].trim();
      // Clean up reason (max 300 chars)
      if (reason.length > 300) {
        reason = reason.substring(0, 300) + '...';
      }
      return reason;
    }
  }

  return null;
}

/**
 * Detect TDIU type (schedular vs extraschedular)
 */
function detectTDIUType(context) {
  // Schedular TDIU indicators
  if (/38\s+CFR\s+(?:§|§)?4\.16\(a\)/i.test(context) || 
      /schedular/i.test(context) ||
      /one\s+disability.*?60%|combined.*?70%/i.test(context)) {
    return 'schedular';
  }

  // Extraschedular TDIU indicators
  if (/38\s+CFR\s+(?:§|§)?4\.16\(b\)/i.test(context) ||
      /extraschedular/i.test(context) ||
      /special\s+consideration/i.test(context)) {
    return 'extraschedular';
  }

  // Mixed indicators
  if (/consideration\s+of/i.test(context)) {
    return 'schedular-with-consideration';
  }

  return 'schedular';  // Default assumption
}

/**
 * Extract specific reasons for unemployability
 */
export function extractSpecificReasons(text) {
  const reasons = [];

  const reasonPatterns = [
    { pattern: /physical\s+limitations/i, reason: 'Physical limitations from service-connected disabilities' },
    { pattern: /mental\s+(?:health\s+)?conditions?/i, reason: 'Mental health conditions' },
    { pattern: /cannot\s+maintain\s+employment/i, reason: 'Unable to maintain substantial employment' },
    { pattern: /lack\s+of\s+stamina/i, reason: 'Lack of stamina/endurance' },
    { pattern: /limited\s+(?:range|ROM)/i, reason: 'Limited range of motion' },
    { pattern: /chronic\s+pain/i, reason: 'Chronic pain interfering with work' },
    { pattern: /(?:PTSD|post-traumatic)/i, reason: 'PTSD symptoms preventing employment' },
    { pattern: /unemployed\s+since/i, reason: 'Unemployed since separation' },
    { pattern: /multiple\s+disabilities/i, reason: 'Combined effect of multiple disabilities' },
    { pattern: /marginal\s+employment/i, reason: 'Only capable of marginal employment' }
  ];

  for (const { pattern, reason } of reasonPatterns) {
    if (pattern.test(text)) {
      reasons.push(reason);
    }
  }

  return reasons;
}

/**
 * Extract prior occupation (if mentioned)
 */
export function extractPriorOccupation(text) {
  const patterns = [
    // "formerly employed as [occupation]"
    /formerly\s+employed\s+as\s+(?:a|an)\s+([A-Za-z\s]+?)(?:\.|,|$)/i,
    
    // "previous occupation: [occupation]"
    /previous\s+occupation\s*[:\s]+([A-Za-z\s]+?)(?:\.|,|$)/i,
    
    // "worked as [occupation]"
    /worked\s+as\s+(?:a|an)\s+([A-Za-z\s]+?)(?:\.|,|before|until)/i,
    
    // "occupation prior to separation: [occupation]"
    /occupation.*?(?:prior\s+to|before)\s+separation\s*[:\s]+([A-Za-z\s]+?)(?:\.|,|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract VA Form reference (usually 21-8940 for TDIU)
 */
export function extractTDIUForm(text) {
  const formPatterns = [
    /VA\s+Form\s+21-8940/i,
    /Form\s+21-8940/i,
    /Application\s+for.*?Individual\s+Unemployability/i
  ];

  for (const pattern of formPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

/**
 * Default export
 */
export default extractTDIU;
