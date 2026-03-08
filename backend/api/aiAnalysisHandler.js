/**
 * AI Entitlement Analysis API Endpoint
 * Calls Claude API to analyze denied conditions and identify alternate theories of entitlement
 */

import fs from 'fs';
import path from 'path';

let anthropicClient;

async function getAnthropicClient() {
  if (anthropicClient) {
    return anthropicClient;
  }

  const module = await import('@anthropic-ai/sdk');
  const Anthropic = module.default || module.Anthropic;
  anthropicClient = new Anthropic();
  return anthropicClient;
}

function getAiMode() {
  if (process.env.AI_MODE === 'offline') {
    return 'offline';
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return 'offline';
  }
  return 'live';
}

function buildOfflineAnalysis(condition, wizardData = null) {
  // Determine applicable theories based on wizard data
  const theories = [
    {
      name: 'Direct Service Connection',
      cfrSections: ['38 CFR §3.303'],
      description: 'Connect the condition to an in-service event, injury, or illness.',
      evidence_required: ['Service treatment records', 'Current diagnosis', 'Nexus opinion'],
      medical_nexus: 'Medical opinion linking the condition to service.',
      feasibility: 'Medium',
      why_feasible: 'Most claims can be evaluated under direct service connection.'
    },
    {
      name: 'Secondary Service Connection',
      cfrSections: ['38 CFR §3.310'],
      description: 'Show the condition is caused or aggravated by a service-connected disability.',
      evidence_required: ['Primary service-connected condition', 'Medical nexus opinion'],
      medical_nexus: 'Medical opinion linking the condition to a service-connected disability.',
      feasibility: 'Medium',
      why_feasible: 'Applicable when a primary service-connected condition exists.'
    },
    {
      name: 'Aggravation of Pre-Existing Condition',
      cfrSections: ['38 CFR §3.306'],
      description: 'Show service permanently worsened a pre-existing condition.',
      evidence_required: ['Pre-service baseline records', 'Post-service worsening evidence'],
      medical_nexus: 'Medical opinion explaining aggravation due to service.',
      feasibility: 'Low',
      why_feasible: 'Requires clear baseline and evidence of worsening due to service.'
    }
  ];

  // Add presumptive theories if wizard data indicates relevant exposure
  if (wizardData && wizardData.serviceExposures) {
    const exposures = wizardData.serviceExposures || [];
    
    if (exposures.includes('agent-orange')) {
      theories.push({
        name: 'Presumptive Condition - Agent Orange Exposure',
        cfrSections: ['38 CFR §3.307(a)(6)'],
        description: 'Service in Vietnam with exposure to Agent Orange creates presumptive conditions.',
        evidence_required: ['Service in Vietnam (1962-1975)', 'Diagnosis of presumptive condition'],
        medical_nexus: 'No nexus opinion needed - presumption applies automatically for covered conditions.',
        feasibility: 'High',
        why_feasible: 'If service verified and condition is presumptive, VA must grant connection.'
      });
    }

    if (exposures.includes('radiation')) {
      theories.push({
        name: 'Presumptive Condition - Radiation Exposure',
        cfrSections: ['38 CFR §3.307(a)(1)'],
        description: 'Service with radiation exposure creates presumptive conditions.',
        evidence_required: ['Documented radiation exposure', 'Diagnosis of presumptive condition'],
        medical_nexus: 'Presumption applies - medical nexus not required.',
        feasibility: 'High',
        why_feasible: 'Presumptive conditions don\'t require medical nexus, just exposure and diagnosis.'
      });
    }

    if (exposures.includes('burn-pit')) {
      theories.push({
        name: 'Presumptive Condition - Burn Pit Exposure',
        cfrSections: ['38 CFR §3.307(a)(13)'],
        description: 'Service with burn pit exposure in Iraq/Afghanistan creates presumptive conditions.',
        evidence_required: ['Service in Iraq/Afghanistan with burn pit exposure', 'Diagnosis of presumptive condition'],
        medical_nexus: 'Presumption applies - medical nexus not required.',
        feasibility: 'Medium',
        why_feasible: 'Presumptive conditions don\'t require nexus; exposure documentation is key.'
      });
    }

    if (exposures.includes('gulf-war')) {
      theories.push({
        name: 'Presumptive Condition - Gulf War Illness',
        cfrSections: ['38 CFR §3.307(a)(10)'],
        description: 'Service in Gulf War theater creates presumptive conditions.',
        evidence_required: ['Service in Gulf War (1990-1991)', 'Diagnosis of presumptive condition'],
        medical_nexus: 'Presumption applies - medical nexus not required.',
        feasibility: 'High',
        why_feasible: 'Gulf War presumptive conditions don\'t require nexus documentation.'
      });
    }

    if (exposures.includes('combat')) {
      theories.push({
        name: 'Combat-Related Exception to Rules',
        cfrSections: ['38 CFR §3.304'],
        description: 'Combat veterans receive more favorable evidentiary consideration.',
        evidence_required: ['Documentation of combat service', 'Medical evidence of condition'],
        medical_nexus: 'Veteran\'s testimony credible as to combat conditions and symptoms.',
        feasibility: 'Medium',
        why_feasible: 'Combat veterans\' statements given more weight in nexus determinations.'
      });
    }
  }

  // Filter action items based on wizard data
  let actionItems = [
    'Gather service treatment records and incident documentation.',
    'Obtain a current diagnosis and medical nexus opinion.'
  ];

  if (wizardData && wizardData.serviceExposures && wizardData.serviceExposures.includes('agent-orange')) {
    actionItems.push('Document Vietnam service dates and locations.');
    actionItems.push('Request VA recognition of Agent Orange presumptive condition.');
  }

  if (wizardData && wizardData.vaRatingHistory === 'yes-rated') {
    actionItems.push('Review current service-connected conditions for secondary claim potential.');
  }

  return {
    condition,
    offline: true,
    notice: 'Offline mode: analysis is deterministic based on wizard responses.',
    alternateTheories: theories,
    most_promising_theory: theories.length > 3 
      ? theories[theories.length - 1].name 
      : 'Direct Service Connection',
    related_conditions: wizardData?.currentConditions || [],
    recent_changes: 'Check VA.gov for latest presumptive condition additions.',
    action_items: actionItems,
    success_likelihood: theories.length > 3 ? 'High' : 'Medium',
    overall_strategy: 'Prioritize theories matching documented service exposures and conditions.',
    wizard_context_applied: !!wizardData
  };
}

// Load the CFR markdown for context
function loadCFRContext() {
  try {
    const filePath = path.resolve(process.cwd(), '38CFR_Part3_and_Part4.md');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.substring(0, 15000); // Increased for better CFR context
    }
  } catch (error) {
    console.error('[CFR Loader] Error loading CFR context:', error.message);
  }
  return null;
}

/**
 * Analyze a denied condition using Claude API
 */
async function handleAnalyzeDeniedCondition(req, res) {
  try {
    const { condition, wizardData } = req.body;

    if (!condition) {
      return res.status(400).json({
        success: false,
        error: 'Missing condition parameter'
      });
    }

    const aiMode = getAiMode();
    if (aiMode === 'offline') {
      return res.status(200).json({
        success: true,
        analysis: buildOfflineAnalysis(condition, wizardData),
        mode: 'offline',
        timestamp: new Date().toISOString()
      });
    }

    const cfrContext = loadCFRContext();

    // Enhanced system prompt focused on alternate theories
    const systemPrompt = `You are an expert VA disability benefits legal advisor with comprehensive knowledge of 38 CFR Parts 3 and 4. Your specialty is identifying alternate theories of entitlement for denied conditions.

KEY ALTERNATE THEORIES TO CONSIDER:
1. **Presumptive Conditions** (38 CFR §3.309):
   - Agent Orange presumptions (Vietnam)
   - Radiation exposure presumptions
   - Mustard gas exposure presumptions
   - Combat-related presumptions
   - Environmental hazard presumptions

2. **Secondary Service Connection** (38 CFR §3.310):
   - Conditions caused BY service-connected condition
   - Medical nexus to service-connected disability
   - Relationship to other granted conditions

3. **Aggravation Claims** (38 CFR §3.306):
   - Pre-existing condition worsened by service
   - Changed from stable to compensable rating
   - Loss of function attributable to service

4. **Direct Service Connection** (38 CFR §3.303):
   - In-service event documented
   - Current medical evidence
   - Medical nexus between service and condition
   - Combat veteran consideration (38 CFR §3.304)

5. **Presumption of Soundness** (38 CFR §3.103):
   - Condition not noted at entrance
   - May establish earlier onset or connection

6. **Change in Law**:
   - Conditions reclassified
   - New presumptive conditions added
   - Regulatory interpretation changes

When analyzing a denied condition:
1. Identify which theory or theories most likely apply
2. Reference specific CFR sections with exact citations
3. Describe what evidence would establish each theory
4. List medical nexus requirements
5. Note any recent regulatory changes
6. Rate feasibility (Low/Medium/High) based on regulatory framework
7. Identify related conditions that could strengthen overall claim`;

    const enhancedPrompt = `ANALYZE THIS DENIED CONDITION FOR ALTERNATE THEORIES:

Denied Condition: ${condition}

${cfrContext ? `\nRELEVANT CFR CONTEXT:\n${cfrContext}` : ''}

REQUIRED OUTPUT (as JSON):
{
  "condition": "${condition}",
  "alternateTheories": [
    {
      "name": "Theory name (Presumptive/Secondary/Aggravation/Direct/etc)",
      "cfrSections": ["38 CFR §X.XXX", "38 CFR §Y.YYY"],
      "description": "How this theory could establish service connection",
      "evidence_required": ["Evidence type 1", "Evidence type 2"],
      "medical_nexus": "What medical evidence needed to link condition to service",
      "feasibility": "Low|Medium|High",
      "why_feasible": "Explanation of why this could work"
    }
  ],
  "most_promising_theory": "Name of theory with highest Success chance",
  "related_conditions": ["Condition that could support this claim", "Another related condition"],
  "recent_changes": "Any new laws/regulations affecting this condition",
  "action_items": ["Specific step 1", "Specific step 2"],
  "success_likelihood": "Low|Medium|High",
  "overall_strategy": "Best approach to pursue this condition"
}

Be specific. Reference exact CFR sections. Identify ALL viable alternate theories.`;

    // Call Claude with enhanced prompting
    const client = await getAnthropicClient();
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: enhancedPrompt
        }
      ]
    });

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      analysis = {
        condition,
        rawAnalysis: responseText,
        parseNote: 'Response was not in expected JSON format'
      };
    }

    return res.status(200).json({
      success: true,
      analysis,
      model: message.model,
      usage: message.usage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AI Endpoint] Error analyzing condition:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze condition',
      hint: 'Check that Claude API key is configured and request format is valid'
    });
  }
}

/**
 * Batch analyze multiple denied conditions
 */
async function handleBulkAnalyze(req, res) {
  try {
    const { conditions } = req.body;

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid conditions array'
      });
    }

    const aiMode = getAiMode();
    if (aiMode === 'offline') {
      const results = conditions.slice(0, 5).map((condition) => {
        const conditionText = typeof condition === 'string' ? condition : condition.condition;
        return {
          success: true,
          analysis: buildOfflineAnalysis(conditionText)
        };
      });

      return res.status(200).json({
        success: true,
        count: results.length,
        results,
        summary: {
          total: conditions.length,
          analyzed: results.length,
          highLikelihood: 0
        },
        mode: 'offline'
      });
    }

    const cfrContext = loadCFRContext();

    // Analyze each condition in parallel (limit to 5)
    const analyses = await Promise.all(
      conditions.slice(0, 5).map(async (condition) => {
        try {
          const conditionText = typeof condition === 'string' ? condition : condition.condition;

          const systemPrompt = `You are a VA disability benefits expert specializing in identifying alternate theories of entitlement under 38 CFR. Identify all viable theories that could establish service connection for a denied condition.`;

          const userPrompt = `DENIED CONDITION: ${conditionText}

Identify ALL alternate theories of entitlement under these CFR sections:
- 38 CFR §3.309 (Presumptive conditions)
- 38 CFR §3.310 (Secondary service connection)
- 38 CFR §3.306 (Aggravation)
- 38 CFR §3.303 (Direct service connection)
- 38 CFR §3.304 (Combat veteran consideration)

${cfrContext ? `\nRELEVANT CFR:\n${cfrContext.substring(0, 5000)}` : ''}

Respond ONLY with valid JSON with this structure:
{
  "condition": "${conditionText}",
  "theories": [
    {
      "name": "Theory Name",
      "cfr": "38 CFR §X.XXX",
      "description": "Brief description",
      "evidence": ["Evidence 1", "Evidence 2"],
      "likelihood": "High|Medium|Low"
    }
  ],
  "most_promising": "Name of best theory",
  "overall_likelihood": "High|Medium|Low"
}`;

          const client = await getAnthropicClient();
          const message = await client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: userPrompt
              }
            ]
          });

          const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { condition: conditionText, error: 'Parse failed' };

          return {
            success: true,
            analysis
          };
        } catch (err) {
          console.error(`Error analyzing ${condition}:`, err);
          return {
            success: false,
            condition: typeof condition === 'string' ? condition : condition.condition,
            error: err.message
          };
        }
      })
    );

    return res.status(200).json({
      success: true,
      count: analyses.length,
      results: analyses,
      summary: {
        total: conditions.length,
        analyzed: analyses.filter(a => a.success).length,
        highLikelihood: analyses.filter(a => a.analysis?.overall_likelihood === 'High').length
      }
    });
  } catch (error) {
    console.error('[AI Endpoint] Bulk analysis error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Health check endpoint
 */
async function handleHealthCheck(req, res) {
  try {
    const aiMode = getAiMode();
    if (aiMode === 'offline') {
      return res.status(200).json({
        success: true,
        mode: 'offline',
        message: 'Offline mode active. Set ANTHROPIC_API_KEY for live AI.'
      });
    }

    // Test basic API connectivity
    const client = await getAnthropicClient();
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Say "OK"'
        }
      ],
      timeout: 5000
    });

    return res.status(200).json({
      success: true,
      message: 'Claude API is connected and operational',
      model: message.model
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Claude API health check failed: ${error.message}`
    });
  }
}

export default {
  handleAnalyzeDeniedCondition,
  handleBulkAnalyze,
  handleHealthCheck
};

