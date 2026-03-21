import { normalizeMosCode } from './normalization.js';

function addSuggestion(bucket, id, label, confidence, rationale) {
  if (bucket.has(id)) {
    return;
  }

  bucket.set(id, {
    id,
    label,
    confidence,
    rationale,
    status: 'pending',
  });
}

export function buildExposureSuggestions({
  deploymentLocations = [],
  serviceEra = '',
  primaryMOS = '',
  additionalMOS = [],
  hazardPayIndicators = [],
}) {
  const suggestions = new Map();

  const normalizedLocations = deploymentLocations.map((value) => String(value || '').toLowerCase());
  const normalizedEra = String(serviceEra || '').toLowerCase();
  const normalizedMos = [primaryMOS, ...additionalMOS].map((value) => normalizeMosCode(value));
  const hazardText = hazardPayIndicators.map((item) => String(item || '').toLowerCase()).join(' ');

  if (normalizedLocations.some((value) => value.includes('iraq') || value.includes('afghanistan') || value.includes('southwest asia'))) {
    addSuggestion(
      suggestions,
      'burn-pit-risk',
      'Airborne hazards / burn pit exposure risk',
      0.91,
      'Deployment location matches post-1990 Southwest Asia operations where particulate and burn pit exposures are common.'
    );
  }

  if (normalizedEra.includes('vietnam')) {
    addSuggestion(
      suggestions,
      'agent-orange-risk',
      'Potential herbicide exposure review',
      0.87,
      'Service era overlaps Vietnam period and should be reviewed for herbicide-related presumptive criteria.'
    );
  }

  if (normalizedMos.some((mos) => /^68|^4N|^HM|^8404/.test(mos))) {
    addSuggestion(
      suggestions,
      'medical-chemical-risk',
      'Medical occupational solvent and sterilant exposure',
      0.71,
      'MOS indicates medical duties that can involve recurring solvent and sterilization chemical contact.'
    );
  }

  if (normalizedMos.some((mos) => /^11|^03|^18|^19/.test(mos))) {
    addSuggestion(
      suggestions,
      'combat-noise-risk',
      'Sustained combat noise exposure',
      0.78,
      'MOS family indicates combat arms roles with high likelihood of repeated weapons-system noise.'
    );
  }

  if (/hostile fire|imminent danger|hazard|combat deployment/.test(hazardText)) {
    addSuggestion(
      suggestions,
      'hazard-pay-risk',
      'Hazard pay indicates elevated environmental exposure risk',
      0.84,
      'Detected hazard or danger pay indicator in extracted DD-214 signals.'
    );
  }

  if (/radiation|nuclear|reactor/.test(hazardText)) {
    addSuggestion(
      suggestions,
      'radiation-risk',
      'Radiation risk activity review recommended',
      0.89,
      'Hazard indicators include radiation or nuclear markers requiring operation-level review.'
    );
  }

  return Array.from(suggestions.values());
}
