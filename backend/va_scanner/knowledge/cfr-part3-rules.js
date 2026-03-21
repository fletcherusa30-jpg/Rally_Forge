/**
 * 38 CFR Part 3 - Service Connection Rules
 * Authoritative rule set for determining service connection types
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CFR_INDEX_PATH = path.resolve(__dirname, '../../../knowledge/cfr/cfr-index.json');

let SECTION_ID_BY_PART_AND_NUMBER = null;

function buildSectionIdMap() {
  if (SECTION_ID_BY_PART_AND_NUMBER) return SECTION_ID_BY_PART_AND_NUMBER;

  const map = new Map();
  try {
    const raw = fs.readFileSync(CFR_INDEX_PATH, 'utf8');
    const bundle = JSON.parse(raw);
    const parts = bundle?.cfrIndex?.parts || [];
    for (const part of parts) {
      for (const section of part?.sections || []) {
        const key = `${part.partNumber}|${String(section.sectionNumber || '').toLowerCase()}`;
        map.set(key, section.id || null);
      }
    }
  } catch {
    // Structured index may not exist yet; keep map empty.
  }

  SECTION_ID_BY_PART_AND_NUMBER = map;
  return SECTION_ID_BY_PART_AND_NUMBER;
}

function localSectionIdFromCitation(cfrCitation) {
  const citation = String(cfrCitation || '');
  const match = citation.match(/\b(3\.\d+[a-z]?)\b/i);
  if (!match) return null;
  const map = buildSectionIdMap();
  return map.get(`3|${String(match[1]).toLowerCase()}`) || null;
}

export const CFR_PART3_RULES = {
  // Direct Service Connection (38 CFR 3.303)
  DIRECT_SERVICE_CONNECTION: {
    criteria: [
      'current disability',
      'in-service event/injury/disease',
      'medical nexus linking the two'
    ],
    keywords: ['service connection', 'direct service connection', 'incurred in service']
  },

  // Secondary Service Connection (38 CFR 3.310)
  SECONDARY_SERVICE_CONNECTION: {
    criteria: [
      'current disability',
      'caused or aggravated by service-connected disability'
    ],
    keywords: ['secondary to', 'caused by', 'aggravated by', 'secondary service connection']
  },

  // Presumptive Service Connection - Chronic Diseases (38 CFR 3.309)
  PRESUMPTIVE_CHRONIC: {
    diseases: [
      'anemia, primary',
      'arteriosclerosis',
      'arthritis',
      'atrophy, progressive muscular',
      'brain hemorrhage',
      'brain thrombosis',
      'bronchiectasis',
      'calculi of the kidney, bladder, or gallbladder',
      'cardiovascular-renal disease',
      'cirrhosis of the liver',
      'coccidioidomycosis',
      'diabetes mellitus',
      'encephalitis lethargica residuals',
      'endocarditis',
      'endocrinopathies',
      'epilepsies',
      'hansen disease',
      'hodgkin disease',
      'leukemia',
      'lupus erythematosus, systemic',
      'myasthenia gravis',
      'myelitis',
      'myocarditis',
      'nephritis',
      'osteitis deformans',
      'osteomalacia',
      'palsy, bulbar',
      'paralysis agitans',
      'psychoses',
      'purpura idiopathic, hemorrhagic',
      'raynaud disease',
      'sarcoidosis',
      'scleroderma',
      'sclerosis, amyotrophic lateral',
      'sclerosis, multiple',
      'syringomyelia',
      'thromboangiitis obliterans',
      'tuberculosis',
      'tumors, malignant',
      'ulcers, peptic'
    ]
  },

  // Presumptive - Herbicide Exposure (38 CFR 3.309(e))
  PRESUMPTIVE_HERBICIDE: {
    locations: ['Vietnam', 'DMZ Korea', 'Thailand', 'Laos', 'Cambodia'],
    dates: '1962-1975 (Vietnam)',
    conditions: [
      'AL amyloidosis',
      'chronic B-cell leukemias',
      'chloracne',
      'diabetes mellitus type 2',
      'hodgkin disease',
      'ischemic heart disease',
      'multiple myeloma',
      'non-hodgkin lymphoma',
      'parkinson disease',
      'peripheral neuropathy, early-onset',
      'porphyria cutanea tarda',
      'prostate cancer',
      'respiratory cancers',
      'soft tissue sarcomas'
    ]
  },

  // Presumptive - Radiation Exposure (38 CFR 3.309(d))
  PRESUMPTIVE_RADIATION: {
    events: [
      'occupation of Hiroshima or Nagasaki',
      'POW in Japan',
      'atmospheric nuclear tests',
      'underground nuclear tests',
      'cleanup of Enewetak Atoll'
    ],
    conditions: [
      'all forms of leukemia',
      'cancer of thyroid, breast, pharynx, esophagus, stomach',
      'cancer of small intestine, pancreas, bile ducts, gallbladder',
      'cancer of salivary gland, urinary tract',
      'lymphomas (except hodgkin disease)',
      'multiple myeloma',
      'primary liver cancer'
    ]
  },

  // Presumptive - Gulf War (38 CFR 3.317)
  PRESUMPTIVE_GULF_WAR: {
    locations: ['Iraq', 'Kuwait', 'Saudi Arabia', 'neutral zone', 'Persian Gulf', 'Arabian Sea', 'Gulf of Aden', 'Gulf of Oman', 'Red Sea', 'airspace above'],
    dates: 'August 2, 1990 - present',
    conditions: [
      'medically unexplained chronic multisymptom illness (MUCMI)',
      'chronic fatigue syndrome',
      'fibromyalgia',
      'functional gastrointestinal disorders',
      'other undiagnosed illnesses'
    ],
    note: 'Must manifest to degree of 10% or more by December 31, 2026'
  },

  // Presumptive - POW (38 CFR 3.309(c))
  PRESUMPTIVE_POW: {
    criteria: 'Former prisoner of war',
    conditions: [
      'psychosis',
      'any anxiety state',
      'dysthymic disorder',
      'organic residuals of frostbite',
      'post-traumatic osteoarthritis',
      'atherosclerotic heart disease',
      'hypertensive vascular disease',
      'stroke and residuals',
      'peptic ulcer disease',
      'chronic dysentery',
      'irritable bowel syndrome',
      'peripheral neuropathy',
      'cirrhosis of the liver',
      'other chronic liver disease without cirrhosis',
      'osteoporosis (if detained 30+ days)',
      'beriberi',
      'pellagra',
      'avitaminosis'
    ]
  },

  // Aggravation (38 CFR 3.310)
  AGGRAVATION: {
    criteria: [
      'preexisting condition',
      'worsened beyond natural progression during service',
      'not due to natural progression'
    ],
    keywords: ['aggravation', 'worsened', 'exacerbated']
  },

  // Continuity of Symptomatology (38 CFR 3.303(b))
  CONTINUITY: {
    criteria: [
      'competent medical evidence of continuity',
      'lay evidence of ongoing symptoms',
      'no requirement for contemporaneous diagnosis'
    ]
  },

  // Combat Presumption (38 CFR 3.304(f))
  COMBAT_PRESUMPTION: {
    criteria: 'Engaged in combat with the enemy',
    rule: 'Satisfactory lay evidence of injury/disease incurred in combat will be accepted as sufficient proof'
  }
};

// Service Connection Type Detector
export function detectServiceConnectionType(conditionText, contextText = '') {
  const text = (conditionText + ' ' + contextText).toLowerCase();
  
  const types = [];
  
  // Check for secondary
  if (/secondary to|caused by|aggravated by|due to service-connected/i.test(text)) {
    const cfr = '38 CFR 3.310';
    types.push({ type: 'SECONDARY', cfr, localSectionId: localSectionIdFromCitation(cfr) });
  }
  
  // Check for aggravation
  if (/aggravat/i.test(text) && !/secondary/i.test(text)) {
    const cfr = '38 CFR 3.310(b)';
    types.push({ type: 'AGGRAVATION', cfr, localSectionId: localSectionIdFromCitation(cfr) });
  }
  
  // Check for presumptive (herbicide)
  const herbicideConditions = CFR_PART3_RULES.PRESUMPTIVE_HERBICIDE.conditions;
  if (herbicideConditions.some(cond => text.includes(cond.toLowerCase()))) {
    const cfr = '38 CFR 3.309(e)';
    types.push({ type: 'PRESUMPTIVE_HERBICIDE', cfr, localSectionId: localSectionIdFromCitation(cfr) });
  }
  
  // Check for presumptive (Gulf War)
  if (/chronic fatigue|fibromyalgia|gulf war|undiagnosed/i.test(text)) {
    const cfr = '38 CFR 3.317';
    types.push({ type: 'PRESUMPTIVE_GULF_WAR', cfr, localSectionId: localSectionIdFromCitation(cfr) });
  }
  
  // Default to direct if no specific type found
  if (types.length === 0) {
    const cfr = '38 CFR 3.303';
    types.push({ type: 'DIRECT', cfr, localSectionId: localSectionIdFromCitation(cfr) });
  }
  
  return types;
}

export default CFR_PART3_RULES;

