import { aiPlaceholders } from './ai.js';
import { claimWizardPlaceholders } from './claimWizard.js';
import { conditionsPlaceholders } from './conditions.js';
import { configPlaceholders } from './config.js';
import { financialPlaceholders } from './financial.js';
import { helperText } from './helperText.js';
import { knowledgePlaceholders } from './knowledge.js';
import { militaryPlaceholders } from './military.js';
import { profilePlaceholders } from './profile.js';
import { strPlaceholders } from './str.js';
import { treatmentPlaceholders } from './treatment.js';
import { vaPlaceholders } from './va.js';

export const placeholders = Object.freeze({
  ai: aiPlaceholders,
  conditions: conditionsPlaceholders,
  financial: financialPlaceholders,
  str: strPlaceholders,
  treatment: treatmentPlaceholders,
  va: vaPlaceholders,
  profile: profilePlaceholders,
  knowledge: knowledgePlaceholders,
  military: militaryPlaceholders,
  claimWizard: claimWizardPlaceholders,
  config: configPlaceholders,
  helperText,
});