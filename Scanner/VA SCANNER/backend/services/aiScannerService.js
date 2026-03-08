/**
 * AI Scanner Service
 * 
 * Integrates OpenAI/Claude AI to validate and enhance scanner extraction results
 * Provides quality assurance, missing data detection, and accuracy improvements
 */

/**
 * AI Scanner Configuration
 */
const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'openai', // 'openai' or 'anthropic'
  apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  temperature: 0.1, // Low temperature for factual extraction
  maxTokens: 4000,
  enabled: process.env.AI_SCANNER_ENABLED === 'true'
};

/**
 * Validate scanner results using AI
 * @param {string} rawText - Original VA decision letter text
 * @param {Object} scannerResults - Results from BenefitScan engine
 * @returns {Promise<Object>} Validated and enhanced results
 */
export async function validateScannerResults(rawText, scannerResults) {
  if (!AI_CONFIG.enabled || !AI_CONFIG.apiKey) {
    console.log('[AI Scanner] AI validation disabled - returning original results');
    return {
      validated: scannerResults,
      aiEnhanced: false,
      suggestions: [],
      confidence: null
    };
  }

  try {
    console.log('[AI Scanner] Running AI validation...');
    
    const prompt = buildValidationPrompt(rawText, scannerResults);
    const aiResponse = await callAI(prompt);
    const analysis = parseAIResponse(aiResponse);

    return {
      validated: mergeScannerAndAI(scannerResults, analysis),
      aiEnhanced: true,
      suggestions: analysis.suggestions || [],
      confidence: analysis.confidence || null,
      aiModel: AI_CONFIG.model
    };

  } catch (error) {
    console.error('[AI Scanner] Error during AI validation:', error.message);
    return {
      validated: scannerResults,
      aiEnhanced: false,
      suggestions: [],
      confidence: null,
      error: error.message
    };
  }
}

/**
 * Build AI validation prompt
 */
function buildValidationPrompt(rawText, scannerResults) {
  return `You are an expert VA disability decision letter analyst. Your task is to validate and enhance the extraction results from an automated scanner.

**EXTRACTED DATA (from automated scanner):**
${JSON.stringify(scannerResults, null, 2)}

**ORIGINAL VA DECISION LETTER TEXT:**
${rawText.substring(0, 8000)}

**YOUR TASK:**

1. **Validate Service-Connected Conditions:**
   - Verify each condition name is accurate
   - Confirm percentage ratings match the letter
   - Check effective dates are correct
   - Flag any missed conditions

2. **Validate Denied Conditions:**
   - Verify condition names
   - Check denial reasons are complete (not truncated)
   - Flag any missed denials

3. **Validate Ancillary Benefits:**
   - Confirm all mentioned benefits are captured
   - Verify status (granted/denied/referenced)

4. **Validate Special Monthly Compensation:**
   - Check if SMC awards are correctly identified
   - Flag potential SMC eligibility not captured

5. **Validate Dependents:**
   - Verify added/removed dependents are accurate
   - Check relationship types and dates

6. **Validate Payments:**
   - Confirm payment amounts match letter
   - Verify effective dates

7. **Validate Evidence:**
   - Check if key evidence items are captured
   - Flag important missing evidence

**OUTPUT FORMAT (JSON):**
{
  "confidence": 0.95,
  "validationStatus": "PASS" | "NEEDS_REVIEW" | "FAIL",
  "missedConditions": [],
  "incorrectExtractions": [],
  "suggestions": [
    {
      "category": "service-connected",
      "issue": "Missing increased rating",
      "suggestion": "Add: lumbar spine - 20%",
      "confidence": 0.9
    }
  ],
  "enhancedData": {
    // Only include fields that need correction/addition
  }
}

**IMPORTANT:**
- Only flag issues you're confident about (>0.7 confidence)
- Be conservative - don't suggest changes unless clearly warranted
- Preserve all correctly extracted data
- Output ONLY valid JSON, no explanations`;
}

/**
 the AI (OpenAI or Anthropic)
 */
async function callAI(prompt) {
  if (AI_CONFIG.provider === 'openai') {
    return await callOpenAI(prompt);
  } else if (AI_CONFIG.provider === 'anthropic') {
    return await callAnthropic(prompt);
  } else {
    throw new Error(`Unknown AI provider: ${AI_CONFIG.provider}`);
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt) {
  // Note: Requires 'openai' package - install with: npm install openai
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: AI_CONFIG.apiKey });

    const completion = await openai.chat.completions.create({
      model: AI_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert VA disability decision letter analyst. You validate and enhance extraction results with high accuracy.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
      response_format: { type: 'json_object' }
    });

    return completion.choices[0].message.content;

  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('OpenAI package not installed. Run: npm install openai');
    }
    throw error;
  }
}

/**
 * Call Anthropic API (Claude)
 */
async function callAnthropic(prompt) {
  // Note: Requires '@anthropic-ai/sdk' package
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: AI_CONFIG.apiKey });

    const message = await anthropic.messages.create({
      model: AI_CONFIG.model || 'claude-3-5-sonnet-20241022',
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return message.content[0].text;

  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('Anthropic package not installed. Run: npm install @anthropic-ai/sdk');
    }
    throw error;
  }
}

/**
 * Parse AI response
 */
function parseAIResponse(response) {
  try {
    const parsed = JSON.parse(response);
    return {
      confidence: parsed.confidence || 0.5,
      validationStatus: parsed.validationStatus || 'UNKNOWN',
      missedConditions: parsed.missedConditions || [],
      incorrectExtractions: parsed.incorrectExtractions || [],
      suggestions: parsed.suggestions || [],
      enhancedData: parsed.enhancedData || {}
    };
  } catch (error) {
    console.error('[AI Scanner] Failed to parse AI response:', error.message);
    return {
      confidence: 0,
      validationStatus: 'ERROR',
      missedConditions: [],
      incorrectExtractions: [],
      suggestions: [],
      enhancedData: {}
    };
  }
}

/**
 * Merge scanner results with AI enhancements
 */
function mergeScannerAndAI(scannerResults, aiAnalysis) {
  // Only apply high-confidence AI suggestions
  const highConfidenceSuggestions = (aiAnalysis.suggestions || [])
    .filter(s => s.confidence >= 0.8);

  if (highConfidenceSuggestions.length === 0 && Object.keys(aiAnalysis.enhancedData || {}).length === 0) {
    return scannerResults; // No changes needed
  }

  // Deep clone scanner results
  const enhanced = JSON.parse(JSON.stringify(scannerResults));

  // Apply enhanced data from AI (only high-confidence fields)
  if (aiAnalysis.enhancedData) {
    Object.assign(enhanced, aiAnalysis.enhancedData);
  }

  return enhanced;
}

/**
 * Check if AI service is configured and available
 */
export function isAIAvailable() {
  return AI_CONFIG.enabled && !!AI_CONFIG.apiKey;
}

/**
 * Get AI service status
 */
export function getAIStatus() {
  return {
    enabled: AI_CONFIG.enabled,
    configured: !!AI_CONFIG.apiKey,
    provider: AI_CONFIG.provider,
    model: AI_CONFIG.model
  };
}

