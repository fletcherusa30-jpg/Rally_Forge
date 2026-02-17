/**
 * DenialReasonLLMTemplate.js
 * 
 * LLM prompt template for extracting complete denial reasons from VA decision letters.
 * This template instructs an LLM to identify denied conditions and extract full denial
 * paragraphs without truncation.
 * 
 * Usage:
 *   const template = new DenialReasonLLMTemplate();
 *   const prompt = template.buildPrompt(documentText);
 *   // Send prompt to LLM
 *   const response = await llm.complete(prompt);
 *   const result = template.parseResponse(response);
 */

class DenialReasonLLMTemplate {
  constructor(config = {}) {
    this.config = {
      model: config.model || 'gpt-4',
      temperature: config.temperature || 0.3,
      max_tokens: config.max_tokens || 2000,
      ...config
    };
  }

  /**
   * Build the system instruction prompt
   */
  buildSystemPrompt() {
    return `You are an expert document analyst specializing in VA (Veterans Affairs) disability decision letters.

Your task is to extract complete denial reasons from VA disability compensation decision documents.

CRITICAL INSTRUCTIONS:

1. For each denied condition, extract the COMPLETE denial reason paragraph.

2. The denial reason is the text immediately following "is denied because" or "was denied because".

3. NEVER stop at the first period (.) unless it ends the complete reason sentence.

4. NEVER truncate mid-sentence. If a reason continues after a period, include it.

5. NEVER merge reasons from multiple conditions.

6. Normalize whitespace: 
   - Collapse multiple spaces into one
   - Collapse line breaks into spaces
   - Trim leading/trailing whitespace

7. Return ONLY valid JSON in the exact format specified.

8. If you cannot extract a reason for a condition, set reason_for_denial to "Unable to extract."

MANDATORY OUTPUT FORMAT:
{
  "denied_conditions": [
    {
      "condition": "string (the condition name)",
      "reason_for_denial": "string (complete paragraph)"
    }
  ]
}`;
  }

  /**
   * Build the user prompt with document content
   */
  buildUserPrompt(documentText) {
    return `Extract all denied conditions and their complete denial reasons from the following VA decision letter:

---BEGIN DOCUMENT---
${documentText}
---END DOCUMENT---

For each denied condition you find:
1. Identify the condition name
2. Extract the COMPLETE reason text following "denied because" or related phrases
3. Include ALL text in the reason paragraph until the next condition is mentioned or the section ends
4. Do NOT truncate at the first period
5. Do NOT stop at punctuation in the middle of the reason
6. If the reason spans multiple sentences, include all sentences

Return the results in the specified JSON format.`;
  }

  /**
   * Build complete prompt (system + user)
   */
  buildPrompt(documentText) {
    return {
      system: this.buildSystemPrompt(),
      user: this.buildUserPrompt(documentText)
    };
  }

  /**
   * Parse LLM response into structured format
   */
  parseResponse(responseText) {
    try {
      // Extract JSON from response (handle cases where LLM wraps it in markdown)
      let jsonText = responseText.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.substring(7);
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.substring(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.substring(0, jsonText.length - 3);
      }
      
      const parsed = JSON.parse(jsonText.trim());
      
      // Validate structure
      if (!Array.isArray(parsed.denied_conditions)) {
        throw new Error('Invalid response structure: missing denied_conditions array');
      }
      
      // Validate each entry
      const validated = parsed.denied_conditions.map(entry => {
        if (!entry.condition || typeof entry.condition !== 'string') {
          throw new Error('Invalid entry: missing or invalid condition');
        }
        if (!entry.reason_for_denial || typeof entry.reason_for_denial !== 'string') {
          throw new Error(`Invalid entry for ${entry.condition}: missing or invalid reason_for_denial`);
        }
        
        return {
          condition: entry.condition.trim(),
          reason_for_denial: entry.reason_for_denial.trim()
        };
      });
      
      return {
        success: true,
        denied_conditions: validated,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        denied_conditions: [],
        error: error.message,
        raw_response: responseText
      };
    }
  }

  /**
   * Validate extraction results
   */
  validateResults(results) {
    const validation = {
      total_conditions: results.denied_conditions.length,
      valid_conditions: [],
      invalid_conditions: [],
      warnings: []
    };

    for (const entry of results.denied_conditions) {
      const issuesFound = [];

      // Check for empty reason
      if (!entry.reason_for_denial || entry.reason_for_denial === 'Unable to extract.') {
        issuesFound.push('Empty or unable to extract reason');
      }

      // Check for obvious truncation
      if (entry.reason_for_denial.endsWith(' the') ||
          entry.reason_for_denial.endsWith(' is') ||
          entry.reason_for_denial.endsWith(' because')) {
        issuesFound.push('Likely truncated at word boundary');
      }

      // Check for incomplete sentence start
      if (entry.reason_for_denial.match(/^(?:and|or|but|that|which|if|when)\s/i)) {
        issuesFound.push('Reason starts with incomplete clause');
      }

      // Check minimum length
      if (entry.reason_for_denial.length < 20) {
        issuesFound.push(`Reason too short (${entry.reason_for_denial.length} chars)`);
      }

      if (issuesFound.length > 0) {
        validation.invalid_conditions.push({
          condition: entry.condition,
          reason: entry.reason_for_denial,
          issues: issuesFound
        });
      } else {
        validation.valid_conditions.push(entry);
      }
    }

    validation.is_valid = validation.invalid_conditions.length === 0;
    return validation;
  }

  /**
   * Format results for display
   */
  formatResults(results) {
    const lines = [];
    lines.push('=== Denied Conditions Extraction Results ===\n');
    
    for (const entry of results.denied_conditions) {
      lines.push(`Condition: ${entry.condition}`);
      lines.push(`Reason: ${entry.reason_for_denial}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DenialReasonLLMTemplate;
}
