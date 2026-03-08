/**
 * 38 CFR Part 4 - Rating Schedule Rules
 * Diagnostic codes, pyramiding rules, bilateral factor, special rules
 */

export const CFR_PART4_RULES = {
  // Bilateral Factor (38 CFR 4.26)
  BILATERAL_FACTOR: {
    rule: 'Add 10% of combined value of bilateral disabilities',
    applicableAnatomies: ['arm', 'hand', 'finger', 'leg', 'foot', 'toe', 'eye', 'ear', 'kidney', 'lung'],
    keywords: ['bilateral', 'both', 'right and left']
  },

  // Pyramiding (38 CFR 4.14)
  PYRAMIDING: {
    rule: 'Do not allow separate evaluations for manifestations of the same disability',
    examples: [
      'Cannot rate both DDD and radiculopathy if radiculopathy is manifestation of DDD',
      'Cannot rate both arthritis and limitation of motion if arthritis causes the limitation',
      'Cannot rate multiple pathologies of same joint under different codes'
    ]
  },

  // Painful Motion (38 CFR 4.59, 4.40)
  PAINFUL_MOTION: {
    rule: 'Painful motion is functional loss and warrants minimum compensable evaluation',
    minRating: 10
  },

  // Functional Loss (38 CFR 4.40)
  FUNCTIONAL_LOSS: {
    rule: 'Functional impairment is the rating criterion',
    factors: ['range of motion', 'strength', 'endurance', 'coordination', 'pain']
  },

  // Amputation Rules (38 CFR 4.63-4.73)
  AMPUTATION: {
    upperExtremity: {
      'forequarter': 90,
      'shoulder disarticulation': 80,
      'above elbow': 70,
      'below elbow': 60,
      'wrist disarticulation': 60,
      'hand': 60,
      'thumb': 30,
      'index or middle finger': 10,
      'ring or little finger': 0
    },
    lowerExtremity: {
      'hemipelvectomy': 100,
      'hip disarticulation': 90,
      'above knee': 60,
      'below knee': 40,
      'ankle': 40,
      'foot': 30
    }
  },

  // Anatomical Structure to DC Mapping (abbreviated - expand as needed)
  DIAGNOSTIC_CODES: {
    musculoskeletal: {
      spine: {
        'cervical spine': [5290, 5291, 5292, 5293, 5294, 5235, 5237],
        'thoracolumbar spine': [5292, 5293, 5295, 5296, 5297, 5235, 5237],
        'lumbar spine': [5292, 5293, 5295, 5296, 5297, 5235, 5237],
        'thoracic spine': [5292, 5293, 5295, 5296, 5297, 5235, 5237]
      },
      joints: {
        'shoulder': [5200, 5201, 5202, 5203],
        'elbow': [5205, 5206, 5207, 5208],
        'wrist': [5209, 5210, 5211, 5212],
        'hip': [5250, 5251, 5252, 5253, 5254, 5255],
        'knee': [5256, 5257, 5258, 5259, 5260, 5261, 5262],
        'ankle': [5270, 5271, 5272, 5273, 5274, 5275, 5276, 5277, 5278, 5279, 5280, 5281, 5282, 5283, 5284]
      },
      feet: {
        'hallux valgus': 5280,
        'hammer toe': 5282,
        'claw foot': 5278,
        'flat foot': 5276,
        'plantar fasciitis': 5284
      },
      nerves: {
        'sciatic nerve': 8520,
        'radial nerve': 8514,
        'median nerve': 8515,
        'ulnar nerve': 8516,
        'tibial nerve': 8525,
        'peroneal nerve': 8522
      }
    },
    mental: {
      'PTSD': 9411,
      'depression': 9434,
      'anxiety': 9400,
      'adjustment disorder': 9440,
      'bipolar disorder': 9432,
      'schizophrenia': 9201
    },
    cardiovascular: {
      'hypertension': 7101,
      'ischemic heart disease': 7005,
      'arrhythmia': 7010,
      'heart valve disease': 7000
    },
    respiratory: {
      'asthma': 6602,
      'COPD': 6604,
      'sleep apnea': 6847,
      'chronic bronchitis': 6600
    },
    digestive: {
      'GERD': 7346,
      'IBS': 7319,
      'Crohn disease': 7323,
      'ulcerative colitis': 7323
    },
    genitourinary: {
      'erectile dysfunction': 7522,
      'kidney disease': 7500,
      'prostate': 7528
    },
    skin: {
      'scars': [7800, 7801, 7802, 7803, 7804, 7805],
      'disfigurement': 7800
    },
    ear: {
      'tinnitus': 6260,
      'hearing loss': [6100, 6200]
    },
    eye: {
      'visual impairment': 6061,
      'blindness': [6063, 6064, 6065]
    }
  },

  // Minimum Compensable Evaluations
  MINIMUM_COMPENSABLE: {
    'painful motion': 10,
    'residuals of TBI': 0,
    'cold injury residuals': 10,
    'scars': 0
  }
};

// Normalize condition to CFR terminology
export function normalizeToCFRTerminology(conditionText) {
  const text = conditionText.toLowerCase();
  
  // Spine normalization
  if (/cervical.*spine|neck|c-?spine/i.test(text)) {
    return { anatomy: 'cervical spine', category: 'musculoskeletal', subcategory: 'spine' };
  }
  if (/thoracic.*spine|t-?spine/i.test(text) || (/thoracic|lumbar/i.test(text) && /spine/i.test(text))) {
    return { anatomy: 'thoracolumbar spine', category: 'musculoskeletal', subcategory: 'spine' };
  }
  if (/lumbar.*spine|l-?spine|low.*back/i.test(text)) {
    return { anatomy: 'lumbar spine', category: 'musculoskeletal', subcategory: 'spine' };
  }
  
  // Joint normalization
  if (/shoulder/i.test(text)) {
    return { anatomy: 'shoulder', category: 'musculoskeletal', subcategory: 'joints' };
  }
  if (/knee/i.test(text)) {
    return { anatomy: 'knee', category: 'musculoskeletal', subcategory: 'joints' };
  }
  if (/ankle/i.test(text)) {
    return { anatomy: 'ankle', category: 'musculoskeletal', subcategory: 'joints' };
  }
  if (/hip/i.test(text)) {
    return { anatomy: 'hip', category: 'musculoskeletal', subcategory: 'joints' };
  }
  if (/elbow/i.test(text)) {
    return { anatomy: 'elbow', category: 'musculoskeletal', subcategory: 'joints' };
  }
  if (/wrist/i.test(text)) {
    return { anatomy: 'wrist', category: 'musculoskeletal', subcategory: 'joints' };
  }
  
  // Foot conditions
  if (/hallux.*valgus|bunion/i.test(text)) {
    return { anatomy: 'hallux valgus', category: 'musculoskeletal', subcategory: 'feet', dc: 5280 };
  }
  if (/hammer.*toe/i.test(text)) {
    return { anatomy: 'hammer toe', category: 'musculoskeletal', subcategory: 'feet', dc: 5282 };
  }
  if (/flat.*foot|pes.*planus/i.test(text)) {
    return { anatomy: 'flat foot', category: 'musculoskeletal', subcategory: 'feet', dc: 5276 };
  }
  
  // Nerves
  if (/sciatic/i.test(text)) {
    return { anatomy: 'sciatic nerve', category: 'musculoskeletal', subcategory: 'nerves', dc: 8520 };
  }
  if (/radiculopathy|radicular/i.test(text)) {
    return { anatomy: 'radiculopathy', category: 'musculoskeletal', subcategory: 'nerves' };
  }
  
  // Mental health
  if (/ptsd|post.*traumatic.*stress/i.test(text)) {
    return { anatomy: 'PTSD', category: 'mental', dc: 9411 };
  }
  if (/depress/i.test(text)) {
    return { anatomy: 'depression', category: 'mental', dc: 9434 };
  }
  if (/anxiety/i.test(text)) {
    return { anatomy: 'anxiety', category: 'mental', dc: 9400 };
  }
  if (/adjustment.*disorder/i.test(text)) {
    return { anatomy: 'adjustment disorder', category: 'mental', dc: 9440 };
  }
  
  // Special conditions
  if (/tinnitus/i.test(text)) {
    return { anatomy: 'tinnitus', category: 'ear', dc: 6260 };
  }
  if (/sleep.*apnea/i.test(text)) {
    return { anatomy: 'sleep apnea', category: 'respiratory', dc: 6847 };
  }
  if (/gerd|gastroesophageal.*reflux/i.test(text)) {
    return { anatomy: 'GERD', category: 'digestive', dc: 7346 };
  }
  if (/erectile.*dysfunction|ed\b/i.test(text)) {
    return { anatomy: 'erectile dysfunction', category: 'genitourinary', dc: 7522 };
  }
  if (/hypertension|high.*blood.*pressure/i.test(text)) {
    return { anatomy: 'hypertension', category: 'cardiovascular', dc: 7101 };
  }
  
  // Default
  return { anatomy: conditionText, category: 'unknown' };
}

// Check if bilateral factor applies
export function checkBilateralApplicability(conditions) {
  const bilateralAnatomies = CFR_PART4_RULES.BILATERAL_FACTOR.applicableAnatomies;
  const pairedConditions = {};
  
  conditions.forEach(cond => {
    const normalized = normalizeToCFRTerminology(cond.condition);
    const anatomy = normalized.anatomy;
    
    // Check if this is a bilateral-eligible anatomy
    const eligible = bilateralAnatomies.some(ba => anatomy.toLowerCase().includes(ba));
    if (eligible) {
      const key = anatomy.replace(/left|right/gi, '').trim();
      if (!pairedConditions[key]) {
        pairedConditions[key] = [];
      }
      pairedConditions[key].push(cond);
    }
  });
  
  // Find true bilateral pairs (both left and right)
  const bilateralPairs = Object.entries(pairedConditions)
    .filter(([key, items]) => {
      const hasLeft = items.some(i => /left/i.test(i.condition));
      const hasRight = items.some(i => /right/i.test(i.condition));
      return hasLeft && hasRight;
    })
    .map(([key, items]) => ({ anatomy: key, conditions: items }));
  
  return bilateralPairs;
}

export default CFR_PART4_RULES;

