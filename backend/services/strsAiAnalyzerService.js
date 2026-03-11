/**
 * STRS AI Analyzer Service
 * 
 * Analyzes Service Treatment Records extractions to determine:
 * - Service connection potential for each condition
 * - Direct, secondary, aggravation, or presumptive pathways
 * - Evidence strength based on documentation
 * - Specific CFR citations and legal basis
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

/**
 * Analyze a condition for service connection potential using AI
 * @param {Object} condition - Condition with all occurrences
 * @param {string} fullText - Full STR text for context
 * @param {Object} metadata - Additional metadata (dates, pages, etc.)
 * @returns {Promise<Object>} Service connection analysis
 */
export async function analyzeServiceConnection(condition, fullText, metadata = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      condition: condition.label,
      canAnalyze: false,
      error: 'AI analysis requires ANTHROPIC_API_KEY environment variable'
    };
  }

  const prompt = buildServiceConnectionPrompt(condition, fullText, metadata);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const analysis = parseAnalysisResponse(response.content[0].text);
    
    return {
      condition: condition.label,
      canAnalyze: true,
      ...analysis,
      aiModel: 'claude-sonnet-4'
    };
  } catch (error) {
    console.error(`[STRS AI] Analysis failed for ${condition.label}:`, error.message);
    return {
      condition: condition.label,
      canAnalyze: false,
      error: error.message
    };
  }
}

/**
 * Build the service connection analysis prompt
 */
function buildServiceConnectionPrompt(condition, _fullText, _metadata) {
  const occurrences = condition.occurrences || [];
  const firstOccurrence = occurrences[0] || {};
  const followUpCount = occurrences.length - 1;

  // Check if condition has negation indicators
  const hasNegation = occurrences.some(occ => occ.negation?.isNegated);
  const negationType = hasNegation ? occurrences.find(occ => occ.negation?.isNegated)?.negation?.type : null;

  // Extract metadata for richer AI context
  const category = condition.category || 'unknown';
  const extractionType = condition.extractionType || 'condition';
  const laterality = firstOccurrence.laterality?.side || null;
  const severity = firstOccurrence.severity?.interpretation || firstOccurrence.severity?.value || null;
  const confidence = condition.confidence?.level || null;
  const confidenceScore = condition.confidence?.score || null;

  return `You are a VA disability claims expert. Analyze this Service Treatment Records (STR) evidence for service connection potential.

CONDITION: ${condition.label}
TYPE: ${extractionType} (${category})
TOTAL MENTIONS: ${occurrences.length}
FIRST DOCUMENTED: ${firstOccurrence.date || 'Unknown date'}
PAGE: ${firstOccurrence.page || 'Unknown'}
FOLLOW-UPS: ${followUpCount}
${laterality ? `LATERALITY: ${laterality.toUpperCase()} side` : ''}
${severity ? `SEVERITY: ${severity}` : ''}
${confidence && confidenceScore ? `EXTRACTION CONFIDENCE: ${confidenceScore}/100 (${confidence.toUpperCase()})` : ''}
${hasNegation ? `\n⚠️ NEGATION DETECTED: This condition appears in a REVIEW/SCREENING section with ${negationType} negation (e.g., "0 occurrences", "denies", "negative for")` : ''}

CONTEXT FROM MEDICAL RECORDS:
${occurrences.map((occ, idx) => `
Occurrence ${idx + 1}:
- Date: ${occ.date || 'Not specified'}
- Page: ${occ.page || 'Not specified'}
- Text: "${occ.matchedText}"
- Context: "${occ.context?.substring(0, 200)}..."
${occ.negation?.isNegated ? `- ⚠️ NEGATED: ${occ.negation.type} ("${occ.negation.trigger}") - ${occ.negation.note || 'Condition documented as absent'}` : ''}
${occ.laterality?.side ? `- Laterality: ${occ.laterality.side.toUpperCase()}` : ''}
${occ.severity?.interpretation ? `- Severity: ${occ.severity.interpretation}` : ''}
`).join('\n')}

${hasNegation ? `
IMPORTANT: This condition appears in medical review/screening sections but is documented as ABSENT or with ZERO occurrences.
- A review section mentioning a condition does NOT mean the condition was diagnosed
- "0 occurrences" or "denies [condition]" means the condition was screened for but NOT FOUND
- For service connection, the condition must be DIAGNOSED, not just reviewed
- If ALL mentions are negated, classification should be "NOT_APPLICABLE" or "REVIEWED_BUT_NOT_DIAGNOSED"
` : ''}

Analyze this condition for VA service connection potential. Provide:

1. SERVICE CONNECTION TYPE (choose ONE):
   - DIRECT: Injury/disease incurred during active service
   - SECONDARY: Condition caused/aggravated by SC condition
   - AGGRAVATION: Pre-existing condition worsened by service
   - PRESUMPTIVE: Meets 38 CFR 3.309 presumptive criteria
   - INSUFFICIENT: Not enough evidence for service connection
   - REVIEWED_NOT_DIAGNOSED: Condition was screened/reviewed but documented as absent (0 occurrences, denied, negative)

2. EVIDENCE STRENGTH (High/Medium/Low/None)

3. LEGAL BASIS: Specific 38 CFR citation(s) OR "Not Applicable - Condition Not Diagnosed"

4. KEY SUPPORTING FACTS: What evidence supports this claim? (2-3 bullet points, or "Condition reviewed but not diagnosed" if negated)
   ${laterality ? `- Consider laterality (${laterality} side) when describing injury/pain` : ''}
   ${severity ? `- Consider documented severity (${severity})` : ''}

5. GAPS IN EVIDENCE: What's missing? (1-2 bullet points)

6. RECOMMENDATION: Brief actionable next step

Format your response as JSON:
{
  "connectionType": "DIRECT|SECONDARY|AGGRAVATION|PRESUMPTIVE|INSUFFICIENT|REVIEWED_NOT_DIAGNOSED",
  "evidenceStrength": "High|Medium|Low|None",
  "legalBasis": "38 CFR citation or explanation",
  "supportingFacts": ["fact 1", "fact 2"],
  "evidenceGaps": ["gap 1", "gap 2"],
  "recommendation": "specific action"
}`;
}

/**
 * Parse AI response into structured analysis
 */
function parseAnalysisResponse(responseText) {
  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback: parse as plain text
    return {
      connectionType: 'INSUFFICIENT',
      evidenceStrength: 'Low',
      legalBasis: 'Unable to determine',
      supportingFacts: [],
      evidenceGaps: ['AI response parsing failed'],
      recommendation: 'Manual review required',
      rawResponse: responseText
    };
  } catch (error) {
    return {
      connectionType: 'INSUFFICIENT',
      evidenceStrength: 'Low',
      legalBasis: 'Parse error',
      supportingFacts: [],
      evidenceGaps: ['Failed to parse AI response'],
      recommendation: 'Manual review required',
      error: error.message
    };
  }
}

/**
 * Analyze multiple conditions in batch
 * @param {Array} conditions - Array of conditions with occurrences
 * @param {string} fullText - Full STR text
 * @param {Object} metadata - Metadata
 * @returns {Promise<Array>} Array of analyses
 */
export async function analyzeMultipleConditions(conditions, fullText, metadata = {}) {
  const analyses = [];
  
  for (const condition of conditions) {
    const analysis = await analyzeServiceConnection(condition, fullText, metadata);
    analyses.push(analysis);
    
    // Rate limit: 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return analyses;
}

export default {
  analyzeServiceConnection,
  analyzeMultipleConditions
};
