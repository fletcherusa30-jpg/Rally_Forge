const MODEL_PRICING = Object.freeze({
  haiku: { inputPerMillion: 1.0, outputPerMillion: 5.0, label: 'Haiku' },
  sonnet: { inputPerMillion: 3.0, outputPerMillion: 15.0, label: 'Sonnet' },
  opus: { inputPerMillion: 15.0, outputPerMillion: 75.0, label: 'Opus' },
});

const DEFAULT_CONFIG = Object.freeze({
  mode: 'design',
  placeholderApiUrl: 'https://api.anthropic.example/v1/messages',
  placeholderApiKey: 'ANTHROPIC_API_KEY_PLACEHOLDER',
  salePricePerSearch: 1.5,
  simulatedLatencyMs: [450, 1400],
  retryCount: 2,
});

function randomInRange([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function estimateTokens(query, context = '') {
  const inputChars = `${query || ''}\n${context || ''}`.length;
  const inputTokens = Math.max(40, Math.round(inputChars / 3.6));
  const outputTokens = Math.max(80, Math.round(inputTokens * 0.55));
  return { inputTokens, outputTokens };
}

function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING.sonnet;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

function buildMockResponse({ query, model }) {
  const heading = `Professional Search Summary (${(MODEL_PRICING[model] || MODEL_PRICING.sonnet).label})`;
  return `${heading}\n\n` +
    `Query: ${query}\n\n` +
    `1) Key policy anchors were identified and prioritized by probable relevance.\n` +
    `2) Evidence linkage opportunities were grouped by service timeline and conditions.\n` +
    `3) Follow-up review should validate source citations before claim strategy use.\n\n` +
    `Design mode result only. No external API calls were made.`;
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function getProfessionalSearchConfig(overrides = {}) {
  return { ...DEFAULT_CONFIG, ...overrides };
}

export async function runProfessionalSearchDesignMode({
  query,
  model = 'sonnet',
  context = '',
  config = DEFAULT_CONFIG,
}) {
  const mergedConfig = getProfessionalSearchConfig(config);
  if (mergedConfig.mode !== 'design') {
    throw new Error('Production mode is disabled in this build. Explicit approval is required before enabling real API calls.');
  }

  if (!String(query || '').trim()) {
    throw new Error('Query is required for professional search.');
  }

  const attempts = Math.max(1, Number(mergedConfig.retryCount || 1));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const latency = randomInRange(mergedConfig.simulatedLatencyMs);
      await wait(latency);

      const tokenUsage = estimateTokens(query, context);
      const cost = calculateCost(model, tokenUsage.inputTokens, tokenUsage.outputTokens);
      const profit = Number(mergedConfig.salePricePerSearch) - cost.totalCost;

      return {
        mode: mergedConfig.mode,
        request: {
          model,
          query,
          placeholderApiUrl: mergedConfig.placeholderApiUrl,
          placeholderApiKey: mergedConfig.placeholderApiKey,
          simulated: true,
        },
        response: {
          text: buildMockResponse({ query, model }),
          latencyMs: latency,
          simulated: true,
        },
        usage: {
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          totalTokens: tokenUsage.inputTokens + tokenUsage.outputTokens,
        },
        billing: {
          salePrice: Number(mergedConfig.salePricePerSearch),
          estimatedCost: cost.totalCost,
          estimatedProfit: profit,
          marginPercent: mergedConfig.salePricePerSearch > 0 ? (profit / Number(mergedConfig.salePricePerSearch)) * 100 : 0,
          currency: 'USD',
        },
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Professional search simulation failed.');
}

export { MODEL_PRICING };
