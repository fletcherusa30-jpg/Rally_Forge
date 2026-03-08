/**
 * Ancillary Benefits Extraction
 * Extracts all ancillary benefits granted or referenced
 */

/**
 * Benefit requirements database
 */
export const BENEFIT_REQUIREMENTS = {
  'DEA': {
    name: "Dependents' Educational Assistance (Chapter 35)",
    shortName: 'DEA / Chapter 35',
    requirements: [
      'Veteran has 100% permanent and total (P&T) disability rating',
      'Or veteran died from service-connected condition',
      'Or veteran is missing in action or POW',
      'Child must be age 18-26 (or age 14-26 for job training)',
      'Spouse eligible if married to veteran before Oct 1, 1981'
    ]
  },
  'CHAMPVA': {
    name: 'CHAMPVA (Civilian Health and Medical Program)',
    shortName: 'CHAMPVA',
    requirements: [
      'Veteran has 100% permanent and total (P&T) disability rating',
      'Or veteran died from service-connected disability',
      'Or veteran died on active duty',
      'Beneficiary not eligible for TRICARE',
      'Must be spouse or dependent child of eligible veteran'
    ]
  },
  'SAH/SHA': {
    name: 'Specially Adapted Housing (SAH/SHA)',
    shortName: 'SAH/SHA Grant',
    requirements: [
      'Loss or loss of use of both lower extremities',
      'Or blindness in both eyes with 5/200 visual acuity or less',
      'Or loss or loss of use of one lower extremity with residuals of organic brain condition',
      'Or certain severe burn injuries',
      'Veterans can receive up to 3 grants (SAH/SHA)'
    ]
  },
  'Automobile': {
    name: 'Automobile Allowance',
    shortName: 'Auto Allowance',
    requirements: [
      'Loss or permanent loss of use of one or both hands or feet',
      'Or permanent impairment of vision in both eyes to a certain degree',
      'Or ankylosis (immobility) of one or both knees or hips',
      'One-time payment for vehicle purchase',
      'May also qualify for adaptive equipment grant'
    ]
  },
  'Clothing': {
    name: 'Clothing Allowance',
    shortName: 'Clothing Allowance',
    requirements: [
      'Service-connected skin condition requiring prescribed medication that damages clothing',
      'Or uses prosthetic or orthopedic device that damages clothing',
      'Or uses medication for service-connected skin condition that stains garments',
      'Annual payment (can be received yearly if eligible)'
    ]
  },
  'VR&E': {
    name: 'Vocational Rehabilitation & Employment (Chapter 31)',
    shortName: 'VR&E / Chapter 31',
    requirements: [
      'Have at least 10% service-connected disability rating',
      'And have an employment handicap (disability limits ability to work)',
      'Or have at least 20% service-connected disability rating',
      'And have a serious employment handicap',
      'Must be within 12 years of separation or notification of rating (extensions possible)'
    ]
  },
  'Caregiver': {
    name: 'Program of Comprehensive Assistance for Family Caregivers',
    shortName: 'Caregiver Support',
    requirements: [
      'Veteran incurred or aggravated serious injury in line of duty on or after Sept 11, 2001',
      'Or incurred/aggravated serious injury before Sept 11, 2001',
      'Veteran needs assistance with activities of daily living',
      'Caregiver must be approved by VA',
      'Provides stipend, training, mental health services, and respite care'
    ]
  }
};

/**
 * Extract all ancillary benefits from normalized text
 * @param {string} normalizedText - Normalized VA decision text
 * @returns {Array<Object>} Array of ancillary benefits
 */
export function extractAncillaryBenefits(normalizedText) {
  if (!normalizedText) return [];

  // Remove the "Additional Benefits" section which only contains informational resources
  // This section lists phone numbers and websites but doesn't indicate grants
  const additionalBenefitsIndex = normalizedText.search(/Additional Benefits[\s\S]*?(?:Education, Training|Medical Care|Home Adaptations)/i);
  let cleanedText = normalizedText;
  if (additionalBenefitsIndex !== -1) {
    // Find the end of this section (usually ends with "WHERE TO SEND" or similar)
    const endIndex = normalizedText.search(/(?:Where to Send|YOUR RIGHTS TO APPEAL|Page \d+)/i);
    if (endIndex > additionalBenefitsIndex) {
      cleanedText = normalizedText.substring(0, additionalBenefitsIndex) + normalizedText.substring(endIndex);
    }
  }

  const benefits = [];
  const seen = new Set();

  // Define comprehensive benefit extraction patterns
  const benefitPatterns = [
    // Dependents' Educational Assistance (Chapter 35)
    {
      names: ['DEA', "Dependents' Educational Assistance", 'Chapter 35', 'Educational assistance'],
      keywords: [
        /dependents?['']?\s+educational\s+assistance/i,
        /chapter\s+35/i,
        /dea\s+(?:eligibility|benefits?)/i,
        /basic\s+eligibility\s+to\s+dependents?['']?\s+educational\s+assistance/i
      ],
      category: 'Education',
      description: "Dependents' Educational Assistance (Chapter 35)"
    },

    // Dependency and Indemnity Compensation
    {
      names: ['DIC', 'Dependency compensation', 'Additional dependency'],
      keywords: [
        /dependency\s+(?:and\s+)?indemnity\s+compensation/i,
        /dic\s+(?:eligibility|benefits?)/i,
        /grant(?:ed)?\s+.*?claim\s+for\s+additional\s+dependency/i,
        /we\s+(?:have\s+)?granted.*?dependency\s+benefits/i
      ],
      category: 'Compensation',
      description: 'Dependency and Indemnity Compensation'
    },

    // CHAMPVA Eligibility
    {
      names: ['CHAMPVA', 'Healthcare'],
      keywords: [
        /champva\s+(?:eligibility|benefits?|coverage)/i,
        /eligible\s+for\s+champva/i,
        /may\s+be\s+eligible\s+for\s+champva/i,
        /champva\s+(?:health\s+)?care/i
      ],
      category: 'Healthcare',
      description: 'CHAMPVA (Civilian Health and Medical Program of the VA)'
    },

    // Commissary and Exchange Privileges
    {
      names: ['Commissary', 'Exchange', 'PX'],
      keywords: [
        /commissary\s+(?:privileges?|access)/i,
        /military\s+exchange\s+(?:privileges?|access)/i,
        /commissary\s+and\s+exchange\s+privileges?/i,
        /(?:post|base)\s+exchange\s+(?:privileges?|access)/i
      ],
      category: 'Benefits',
      description: 'Commissary and Exchange Privileges'
    },

    // Travel Reimbursement
    {
      names: ['Travel reimbursement', 'Travel benefits'],
      keywords: [
        /travel\s+reimbursement\s+(?:eligibility|benefits?)/i,
        /eligible\s+for\s+travel\s+reimbursement/i,
        /va\s+travel\s+benefits?/i,
        /mileage\s+reimbursement/i
      ],
      category: 'Benefits',
      description: 'Travel Reimbursement Eligibility'
    },

    // Clothing Allowance
    {
      names: ['Clothing allowance', 'Clothing benefit'],
      keywords: [
        /clothing\s+allowance/i,
        /special\s+clothing\s+allowance/i,
        /eligible\s+for\s+clothing\s+allowance/i,
        /annual\s+clothing\s+allowance/i
      ],
      category: 'Compensation',
      description: 'Clothing Allowance'
    },

    // Home Adaptation (SAH/SHA)
    {
      names: ['SAH', 'SHA', 'Home adaptation', 'Specially adapted housing'],
      keywords: [
        /specially\s+adapted\s+(?:housing|home)/i,
        /sah\s+(?:eligibility|benefits?)/i,
        /sha\s+(?:eligibility|benefits?)/i,
        /(?:specially\s+adapted\s+)?housing\s+(?:grant|assistance)/i,
        /home\s+(?:adaptation|modification)\s+(?:grant|assistance)/i
      ],
      category: 'Housing',
      description: 'Specially Adapted Housing (SAH/SHA)'
    },

    // Automobile Allowance
    {
      names: ['Automobile allowance', 'Vehicle grant'],
      keywords: [
        /automobile\s+allowance/i,
        /vehicle\s+(?:grant|allowance)/i,
        /adaptive\s+equipment\s+for\s+automobile/i,
        /eligible\s+for\s+(?:an?\s+)?automobile\s+allowance/i
      ],
      category: 'Benefits',
      description: 'Automobile Allowance'
    },

    // Vocational Rehabilitation
    {
      names: ['VR&E', 'Vocational rehabilitation', 'Chapter 31'],
      keywords: [
        /vocational\s+rehabilitation\s+(?:and\s+)?employment/i,
        /chapter\s+31/i,
        /vr[&e]\s+(?:eligibility|benefits?)/i,
        /eligible\s+for\s+vr[&e]/i
      ],
      category: 'Education',
      description: 'Vocational Rehabilitation and Employment (Chapter 31)'
    },

    // VA Life Insurance
    {
      names: ['VALife', 'S-DVI', 'Life insurance'],
      keywords: [
        /valife\s+(?:insurance|coverage)/i,
        /s-dvi\s+(?:insurance|coverage)/i,
        /servicemembers?\s+(?:group\s+)?life\s+insurance/i,
        /sgli/i,
        /eligible\s+for\s+(?:va\s+)?life\s+insurance/i
      ],
      category: 'Insurance',
      description: 'VA Life Insurance (VALife/S-DVI)'
    },

    // CRDP/CRSC
    {
      names: ['CRDP', 'CRSC', 'Concurrent receipt'],
      keywords: [
        /combat\s+related\s+special\s+compensation/i,
        /crsc/i,
        /concurrent\s+retirement\s+and\s+disability\s+pay/i,
        /crdp/i,
        /military\s+retired\s+pay\s+and\s+va\s+disability/i
      ],
      category: 'Compensation',
      description: 'Combat-Related Special Compensation (CRSC/CRDP)'
    },

    // VA Healthcare
    {
      names: ['VA Healthcare', 'Priority group'],
      keywords: [
        /va\s+(?:health\s+)?(?:care|medical)\s+(?:priority|group)/i,
        /priority\s+(?:group|level)\s+\d+/i,
        /eligible\s+for\s+va\s+(?:health\s+)?care/i,
        /va\s+healthcare\s+(?:eligibility|enrollment)/i
      ],
      category: 'Healthcare',
      description: 'VA Healthcare Priority Group'
    },

    // Survivors Pension
    {
      names: ['Survivors Pension', "Surviving Spouse's Pension"],
      keywords: [
        /surviving\s+(?:spouse|child|dependent)\s+(?:benefits?|pension)/i,
        /survivor\s+benefits?/i,
        /death\s+benefits?/i,
        /survivors?[\s']?\s*pension/i
      ],
      category: 'Survivors Benefits',
      description: "Survivors' Pension"
    },

    // Aid & Attendance
    {
      names: ['A&A', 'Aid and Attendance', 'Housebound'],
      keywords: [
        /aid\s+and\s+attendance/i,
        /a[&]a/i,
        /housebound\s+(?:allowance|benefits?|supplement)/i,
        /aid\s+and\s+(?:attendance|housebound)/i,
        /eligible\s+for\s+(?:aid|a[&]a|housebound)/i
      ],
      category: 'Compensation',
      description: 'Aid and Attendance Allowance'
    },

    // Retraining Under Transferred Entitlement
    {
      names: ['Chapter 33', 'Post-9/11 GI Bill'],
      keywords: [
        /post-?9\/11\s+gi\s+bill/i,
        /chapter\s+33/i,
        /transferred\s+(?:education|gi\s+bill)/i,
        /education\s+benefits?\s+for\s+dependents?/i
      ],
      category: 'Education',
      description: 'Post-9/11 GI Bill / Chapter 33'
    },

    // SMC-K (Erectile Dysfunction)
    {
      names: ['SMC-K', 'Special Monthly Compensation K'],
      keywords: [
        /smc-?k/i,
        /special\s+monthly\s+compensation.*?k/i,
        /erectile\s+dysfunction.*?smc/i,
        /loss\s+of\s+use\s+of.*?penis/i
      ],
      category: 'Compensation',
      description: 'Special Monthly Compensation K (ED)'
    }
  ];

  // Extract each benefit using the cleaned text (without informational sections)
  benefitPatterns.forEach((benefit, benefitIndex) => {
    benefit.keywords.forEach((pattern, patternIndex) => {
      let match;
      // Use exec for global patterns, or test for simple patterns
      if (typeof pattern.exec === 'function') {
        const globalPattern = new RegExp(pattern.source, 'g' + (pattern.flags || ''));
        while ((match = globalPattern.exec(cleanedText)) !== null) {
          // Verify this is an actual grant/eligibility statement, not just informational
          const context = cleanedText.substring(Math.max(0, match.index - 100), Math.min(cleanedText.length, match.index + 200));
          if (isActualGrant(context, benefit)) {
            addBenefit(benefit, benefitIndex, patternIndex);
          }
        }
      } else if (pattern.test(cleanedText)) {
        const match = cleanedText.match(pattern);
        if (match) {
          const context = cleanedText.substring(Math.max(0, match.index - 100), Math.min(cleanedText.length, match.index + 200));
          if (isActualGrant(context, benefit)) {
            addBenefit(benefit, benefitIndex, patternIndex);
          }
        }
      }
    });
  });

  // Helper to determine if this is an actual grant vs informational reference
  function isActualGrant(context, benefit) {
    // Exclude if in informational context
    const informationalPhrases = [
      /for more information/i,
      /please call/i,
      /please visit/i,
      /contact your/i,
      /www\./i,
      /http/i,
      /\d{3}-\d{3}-\d{4}/,  // phone numbers
      /may be eligible for/i  // potential eligibility, not actual
    ];
    
    for (const phrase of informationalPhrases) {
      if (phrase.test(context)) {
        return false;
      }
    }
    
    // Require explicit grant or eligibility establishment language
    const grantPhrases = [
      /is granted/i,
      /is established/i,
      /we (?:have )?granted/i,
      /you are (?:now )?eligible/i,
      /eligibility (?:is|has been) (?:granted|established)/i,
      /entitle(?:d|ment) to/i
    ];
    
    for (const phrase of grantPhrases) {
      if (phrase.test(context)) {
        return true;
      }
    }
    
    // Default to false - must have explicit grant language
    return false;
  }

  // Helper to add benefit to set
  function addBenefit(benefit, benefitIndex, patternIndex) {
    const benefitKey = benefit.description;
    if (!seen.has(benefitKey)) {
      seen.add(benefitKey);
      
      // Find requirements data for this benefit
      const requirementsKey = Object.keys(BENEFIT_REQUIREMENTS).find(key => 
        benefit.names.some(name => name.toLowerCase().includes(key.toLowerCase()))
      );
      
      benefits.push({
        benefit: benefit.description,
        shortName: benefit.names[0],
        category: benefit.category,
        status: 'Referenced',
        extractionPattern: `Pattern ${patternIndex + 1}`,
        evidenceSource: 'VA Rating Decision',
        requirements: requirementsKey ? BENEFIT_REQUIREMENTS[requirementsKey].requirements : [],
        requirementsKey: requirementsKey
      });
      console.log(`[Ancillary Benefit] Extracted: ${benefit.description}`);
    }
  }

  return benefits;
}

/**
 * Get all standard ancillary benefits (whether found in rating or not)
 * @param {Array<Object>} foundBenefits - Benefits extracted from rating
 * @returns {Array<Object>} All benefits with status
 */
export function getAllAncillaryBenefits(foundBenefits = []) {
  const allBenefits = [];
  
  // Map of benefit keys to their patterns
  const benefitMap = {
    'DEA': ['dea', 'chapter 35', 'educational assistance'],
    'CHAMPVA': ['champva'],
    'SAH/SHA': ['sah', 'sha', 'housing', 'home adaptation'],
    'Automobile': ['automobile', 'vehicle'],
    'Clothing': ['clothing allowance'],
    'VR&E': ['vr&e', 'chapter 31', 'vocational'],
    'Caregiver': ['caregiver']
  };
  
  Object.keys(BENEFIT_REQUIREMENTS).forEach(key => {
    const reqData = BENEFIT_REQUIREMENTS[key];
    
    // Check if this benefit was found in the rating
    const found = foundBenefits.find(fb => 
      benefitMap[key].some(pattern => 
        fb.benefit.toLowerCase().includes(pattern) || 
        fb.shortName.toLowerCase().includes(pattern)
      )
    );
    
    if (found) {
      // Benefit was in rating - keep its status
      allBenefits.push({
        ...found,
        name: reqData.name,
        shortName: reqData.shortName,
        requirements: reqData.requirements,
        inRating: true
      });
    } else {
      // Benefit not in rating - mark as not found
      allBenefits.push({
        benefit: reqData.name,
        shortName: reqData.shortName,
        category: key === 'DEA' || key === 'VR&E' ? 'Education' : 
                  key === 'CHAMPVA' ? 'Healthcare' : 
                  key === 'SAH/SHA' || key === 'Automobile' ? 'Housing/Vehicle' : 'Benefits',
        status: 'Not in Rating',
        requirements: reqData.requirements,
        inRating: false
      });
    }
  });
  
  return allBenefits;
}

/**
 * Determine if veteran explicitly granted each benefit
 * @param {string} normalizedText - Normalized text
 * @param {Array<Object>} benefits - Benefits from extractAncillaryBenefits
 * @returns {Array<Object>} Enhanced benefits with grant status
 */
export function enhanceBenefitStatus(normalizedText, benefits) {
  return benefits.map(benefit => {
    // Check for explicit grants or eligibility statements
    const grantedPatterns = [
      new RegExp(`we\\s+(?:have\\s+)?granted.*?${benefit.shortName}`, 'i'),
      new RegExp(`you\\s+(?:are|will be)\\s+eligible\\s+for.*?${benefit.shortName}`, 'i'),
      new RegExp(`${benefit.shortName}.*?(?:is\\s+)?granted`, 'i'),
      new RegExp(`approved\\s+for.*?${benefit.shortName}`, 'i')
    ];

    const deniedPatterns = [
      new RegExp(`we\\s+(?:have\\s+)?denied.*?${benefit.shortName}`, 'i'),
      new RegExp(`${benefit.shortName}.*?(?:is\\s+)?denied`, 'i'),
      new RegExp(`not\\s+eligible\\s+for.*?${benefit.shortName}`, 'i')
    ];

    // Check for denial first (more specific)
    for (const pattern of deniedPatterns) {
      if (pattern.test(normalizedText)) {
        return { ...benefit, status: 'Denied' };
      }
    }

    // Check for grant
    for (const pattern of grantedPatterns) {
      if (pattern.test(normalizedText)) {
        return { ...benefit, status: 'Granted' };
      }
    }

    // Keep as "Referenced" if no explicit grant or denial found
    return benefit;
  });
}

