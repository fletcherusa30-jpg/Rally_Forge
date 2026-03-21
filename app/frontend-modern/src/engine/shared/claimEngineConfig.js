export const FOLLOW_UP_QUESTION_LIBRARY = {
  missingCurrentTreatment: [
    'Have you received any recent treatment for this condition?',
    'Do you have private medical records that document ongoing symptoms?',
  ],
  missingSTR: [
    'Did this condition begin during service or shortly after separation?',
    'Do you have any buddy statements or witness accounts of the in-service event?',
  ],
  missingFunctionalImpact: [
    'How does this condition affect your daily activities or ability to work?',
    'Has this condition caused limitations in mobility, concentration, or stamina?',
  ],
  deniedPreviously: [
    'Do you have new and relevant evidence since the last VA decision?',
    'Has the condition worsened or changed since the denial?',
  ],
  secondaryCandidate: [
    'Has your primary service-connected condition caused or worsened this condition?',
    'Did symptoms begin after the onset of your primary condition?',
  ],
  exposureLinked: [
    'Did you experience symptoms during or shortly after deployment?',
    'Were you exposed to burn pits, chemicals, radiation, or environmental hazards?',
  ],
  worseningTrend: [
    'Have your symptoms become more frequent or severe recently?',
    'Has your provider recommended new medications or increased dosages?',
  ],
};

export const DBQ_MAPPING_TABLE = {
  'hearing loss': 'Hearing Loss and Tinnitus DBQ',
  tinnitus: 'Hearing Loss and Tinnitus DBQ',
  ptsd: 'Review PTSD DBQ',
  depression: 'Mental Disorders DBQ',
  anxiety: 'Mental Disorders DBQ',
  'back pain': 'Back (Thoracolumbar Spine) DBQ',
  'neck pain': 'Neck (Cervical Spine) DBQ',
  radiculopathy: 'Peripheral Nerves DBQ',
  'knee pain': 'Knee and Lower Leg DBQ',
  'ankle pain': 'Ankle DBQ',
  'shoulder pain': 'Shoulder and Arm DBQ',
  migraines: 'Headaches DBQ',
  'migraine headaches': 'Headaches DBQ',
  'sleep apnea': 'Sleep Apnea DBQ',
  diabetes: 'Diabetes Mellitus DBQ',
  'diabetes mellitus type 2': 'Diabetes Mellitus DBQ',
  'heart disease': 'Heart Conditions DBQ',
  'gulf war illness': 'Gulf War General Medical DBQ',
  'skin conditions': 'Skin Diseases DBQ',
  scars: 'Scars/Disfigurement DBQ',
};

export const FORM_RECOMMENDATION_RULESET = {
  primary: ['21-526EZ'],
  secondary: ['21-526EZ'],
  presumptive: ['21-526EZ'],
  aggravation: ['21-526EZ'],
  reopen: ['20-0995'],
  increase: ['21-526EZ', '20-0995'],
  conflictDetected: ['20-0996'],
  boardAppeal: ['10182'],
};

export const EXPOSURE_CONDITION_MAP = {
  'burn pits': ['asthma', 'rhinitis', 'sinusitis', 'bronchitis', 'sleep apnea', 'lung disease'],
  'agent orange': ['diabetes mellitus type 2', 'ischemic heart disease', 'parkinsonism', 'prostate cancer', 'respiratory cancers', 'chronic b-cell leukemia'],
  radiation: ['thyroid cancer', 'breast cancer', 'leukemia', 'lymphoma', 'multiple myeloma'],
  'gulf war service': ['gulf war illness', 'fibromyalgia', 'chronic fatigue syndrome', 'functional gi disorders'],
  'combat service': ['post-traumatic stress disorder', 'tinnitus', 'hearing loss', 'orthopedic injuries'],
  'hazardous noise': ['hearing loss', 'tinnitus'],
};

export const EVIDENCE_SOURCE_PRIORITY = {
  STR: 1,
  Treatment: 2,
  Service: 3,
  'Rating Decision': 4,
  Derived: 5,
};
