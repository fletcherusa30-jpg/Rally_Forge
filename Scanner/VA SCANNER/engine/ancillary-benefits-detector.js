/**
 * Ancillary Benefits Detection Engine
 * Based on 38 CFR Part 3 and M21-1 guidance
 * 
 * Detects: DEA, CHAMPVA, Clothing Allowance, Auto Grant, SAH/SHA, A&A, Housebound, etc.
 */

export const ANCILLARY_BENEFITS_RULES = {
  // Dependents' Educational Assistance (DEA / Chapter 35) - 38 CFR 3.812
  DEA: {
    name: 'Dependents\' Educational Assistance (Chapter 35)',
    cfr: '38 CFR 3.812',
    eligibilityCriteria: [
      'Veteran is permanently and totally disabled (P&T)',
      'Veteran died from service-connected disability',
      'Veteran is missing in action or POW'
    ],
    keywords: ['DEA', 'Chapter 35', 'dependents educational assistance', 'P&T', 'permanent and total'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      // Explicit mention
      const explicitDEA = /\bDEA\b|chapter\s*35|dependents.*educational.*assistance/i.test(text);
      if (explicitDEA) {
        return { status: 'eligible', reason: 'Explicitly mentioned in decision', evidence: 'DEA language found' };
      }
      
      // Inferred from P&T status
      const isPT = /permanent.*total|p&?t/i.test(text);
      const has100 = conditions.some(c => c.percentage >= 100);
      
      if (isPT && has100) {
        return { 
          status: 'inferred eligible', 
          reason: 'P&T status triggers DEA eligibility for dependents', 
          evidence: 'Permanent and total disability',
          cfr: '38 CFR 3.812(a)(1)'
        };
      }
      
      return { status: 'not detected', reason: 'No P&T status or explicit mention' };
    }
  },

  // CHAMPVA - 38 CFR 17.270
  CHAMPVA: {
    name: 'Civilian Health and Medical Program of the Department of Veterans Affairs',
    cfr: '38 CFR 17.270',
    eligibilityCriteria: [
      'Spouse/child of veteran rated P&T',
      'Surviving spouse/child of veteran who died from SC disability',
      'Surviving spouse/child of veteran rated P&T at time of death'
    ],
    keywords: ['CHAMPVA', 'medical program', 'health care eligibility'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      // Explicit mention
      const explicitCHAMPVA = /champva/i.test(text);
      if (explicitCHAMPVA) {
        return { status: 'eligible', reason: 'Explicitly mentioned', evidence: 'CHAMPVA language found' };
      }
      
      // Inferred from P&T
      const isPT = /permanent.*total|p&?t/i.test(text);
      const has100 = conditions.some(c => c.percentage >= 100);
      
      if (isPT && has100) {
        return { 
          status: 'inferred eligible', 
          reason: 'P&T status triggers CHAMPVA for eligible family members', 
          evidence: 'P&T rating',
          cfr: '38 CFR 17.270'
        };
      }
      
      return { status: 'not detected', reason: 'No P&T status detected' };
    }
  },

  // Clothing Allowance - 38 CFR 3.810
  CLOTHING_ALLOWANCE: {
    name: 'Annual Clothing Allowance',
    cfr: '38 CFR 3.810',
    eligibilityCriteria: [
      'Prosthetic or orthotic device due to SC disability',
      'Device tends to wear or tear clothing',
      'Medication causes irreparable damage to outer garments'
    ],
    keywords: ['clothing allowance', 'prosthetic', 'orthotic', 'brace', 'wheelchair'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      // Explicit mention
      const explicitClothing = /clothing\s*allowance/i.test(text);
      if (explicitClothing) {
        return { status: 'eligible', reason: 'Explicitly granted', evidence: 'Clothing allowance mentioned' };
      }
      
      // Inferred from prosthetic/orthotic conditions
      const hasProsthetic = /prosth|orthotic|brace|wheelchair|crutch|walker|cane/i.test(text);
      const hasAmputation = conditions.some(c => /amputat|loss.*limb|loss.*leg|loss.*arm/i.test(c.condition));
      
      if (hasProsthetic || hasAmputation) {
        return { 
          status: 'inferred eligible', 
          reason: 'Prosthetic/orthotic device use detected', 
          evidence: hasProsthetic ? 'Prosthetic language found' : 'Amputation detected',
          cfr: '38 CFR 3.810'
        };
      }
      
      return { status: 'not detected', reason: 'No prosthetic/orthotic use detected' };
    }
  },

  // Automobile Grant - 38 CFR 3.808
  AUTO_GRANT: {
    name: 'Automobile or Other Conveyance Grant',
    cfr: '38 CFR 3.808',
    eligibilityCriteria: [
      'Loss or loss of use of one or both hands/feet',
      'Permanent impairment of vision in both eyes',
      'Ankylosis of hips/knees'
    ],
    keywords: ['automobile grant', 'auto grant', 'adaptive equipment', 'vehicle grant'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      // Explicit mention
      const explicitAuto = /automobile\s*grant|auto\s*grant|vehicle\s*grant|adaptive.*equipment/i.test(text);
      if (explicitAuto) {
        return { status: 'eligible', reason: 'Explicitly granted', evidence: 'Auto grant mentioned' };
      }
      
      // Inferred from qualifying disabilities
      const hasLimbLoss = conditions.some(c => /loss.*hand|loss.*foot|amputat/i.test(c.condition));
      const hasVisionLoss = conditions.some(c => /blind|vision.*impair/i.test(c.condition));
      const hasAnkylosis = conditions.some(c => /ankylosis.*hip|ankylosis.*knee/i.test(c.condition));
      
      if (hasLimbLoss || hasVisionLoss || hasAnkylosis) {
        return { 
          status: 'inferred eligible', 
          reason: 'Qualifying disability detected for auto grant', 
          evidence: hasLimbLoss ? 'Limb loss' : hasVisionLoss ? 'Vision impairment' : 'Ankylosis',
          cfr: '38 CFR 3.808'
        };
      }
      
      return { status: 'not detected', reason: 'No qualifying disabilities detected' };
    }
  },

  // Specially Adapted Housing (SAH) - 38 CFR 3.809
  SAH: {
    name: 'Specially Adapted Housing (SAH) Grant',
    cfr: '38 CFR 3.809',
    eligibilityCriteria: [
      'Loss or loss of use of both lower extremities',
      'Blindness with loss of use of one lower extremity',
      'Loss/loss of use of one lower extremity plus residuals of organic disease',
      'Severe burn injuries'
    ],
    keywords: ['SAH', 'specially adapted housing', 'home adaptation', 'housing grant'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      // Explicit mention
      const explicitSAH = /\bSAH\b|specially\s*adapted\s*housing|housing\s*grant/i.test(text);
      if (explicitSAH) {
        return { status: 'eligible', reason: 'Explicitly mentioned', evidence: 'SAH language found' };
      }
      
      // Inferred from qualifying disabilities
      const lowerExtremityConditions = conditions.filter(c => /leg|foot|ankle|knee|hip|lower.*extremity/i.test(c.condition));
      const hasBilateralLowerLoss = lowerExtremityConditions.length >= 2;
      const hasBlindness = conditions.some(c => /blind/i.test(c.condition));
      const hasSevereBurn = conditions.some(c => /burn/i.test(c.condition) && c.percentage >= 30);
      
      if (hasBilateralLowerLoss || (hasBlindness && lowerExtremityConditions.length > 0) || hasSevereBurn) {
        return { 
          status: 'inferred eligible', 
          reason: 'Qualifying disability for SAH', 
          evidence: hasBilateralLowerLoss ? 'Bilateral lower extremity issues' : 'Blindness + lower extremity',
          cfr: '38 CFR 3.809(a)'
        };
      }
      
      return { status: 'not detected', reason: 'No SAH qualifying disabilities' };
    }
  },

  // Special Home Adaptation (SHA) - 38 CFR 3.809
  SHA: {
    name: 'Special Home Adaptation (SHA) Grant',
    cfr: '38 CFR 3.809',
    eligibilityCriteria: [
      'Blindness in both eyes',
      'Loss or loss of use of both upper extremities'
    ],
    keywords: ['SHA', 'special home adaptation', 'home modification'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      // Explicit mention
      const explicitSHA = /\bSHA\b|special\s*home\s*adaptation/i.test(text);
      if (explicitSHA) {
        return { status: 'eligible', reason: 'Explicitly mentioned', evidence: 'SHA language found' };
      }
      
      // Inferred
      const upperExtremityConditions = conditions.filter(c => /arm|hand|shoulder|elbow|wrist|upper.*extremity/i.test(c.condition));
      const hasBilateralUpper = upperExtremityConditions.length >= 2;
      const hasBlindness = conditions.some(c => /blind.*both.*eyes/i.test(c.condition));
      
      if (hasBilateralUpper || hasBlindness) {
        return { 
          status: 'inferred eligible', 
          reason: 'SHA qualifying criteria met', 
          evidence: hasBilateralUpper ? 'Bilateral upper extremity issues' : 'Blindness',
          cfr: '38 CFR 3.809(b)'
        };
      }
      
      return { status: 'not detected', reason: 'No SHA qualifying disabilities' };
    }
  },

  // Aid and Attendance (A&A) - 38 CFR 3.352
  AID_AND_ATTENDANCE: {
    name: 'Aid and Attendance',
    cfr: '38 CFR 3.352',
    eligibilityCriteria: [
      'Bedridden',
      'Need for assistance with daily activities',
      'Blind or nearly blind',
      'Patient in nursing home due to mental/physical incapacity'
    ],
    keywords: ['aid and attendance', 'A&A', 'bedridden', 'assistance', 'nursing home'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      const aaPhrase = /aid\s*and\s*attendance|a\s*&\s*a\b/i;
      const aaDenied = /(aid\s*and\s*attendance|a\s*&\s*a\b)[^.\n]{0,120}(denied|not\s+granted|not\s+warranted)|\b(denied|not\s+granted|not\s+warranted)[^.\n]{0,120}(aid\s*and\s*attendance|a\s*&\s*a\b)/i.test(text);
      if (aaDenied) {
        return { status: 'not detected', reason: 'A&A explicitly denied in decision text' };
      }

      // Explicit grant/award context only (mention alone is not enough)
      const aaGranted = /(aid\s*and\s*attendance|a\s*&\s*a\b)[^.\n]{0,120}(granted|awarded|established)|\b(granted|awarded|established)[^.\n]{0,120}(aid\s*and\s*attendance|a\s*&\s*a\b)/i.test(text);
      const explicitAA = aaPhrase.test(text) || /bedridden|nursing\s*home/i.test(text);
      if (explicitAA && aaGranted) {
        return { status: 'eligible', reason: 'Aid and attendance explicitly granted', evidence: 'A&A grant language found' };
      }
      
      // Inferred from high ratings or conditions
      const has100 = conditions.some(c => c.percentage >= 100);
      const hasMentalHealth = conditions.some(c => /ptsd|depress|anxiety|tbi|brain.*injury|schizophrenia|bipolar/i.test(c.condition) && c.percentage >= 70);
      const hasBlindness = conditions.some(c => /blind/i.test(c.condition));
      
      if ((has100 && hasMentalHealth) || hasBlindness) {
        return { 
          status: 'inferred eligible', 
          reason: 'May qualify for A&A based on severity of disabilities', 
          evidence: hasBlindness ? 'Blindness' : '100% + severe mental health',
          cfr: '38 CFR 3.352',
          note: 'Requires medical evidence of need for daily assistance'
        };
      }
      
      return { status: 'not detected', reason: 'No A&A indicators detected' };
    }
  },

  // Housebound - 38 CFR 3.351
  HOUSEBOUND: {
    name: 'Housebound Benefit',
    cfr: '38 CFR 3.351',
    eligibilityCriteria: [
      'One 100% disability + confined to dwelling',
      'One 100% disability + additional disabilities >= 60%'
    ],
    keywords: ['housebound', 'confined to dwelling', 'substantially confined'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      const houseboundDenied = /(housebound|confined.*dwelling)[^.\n]{0,120}(denied|not\s+granted|not\s+warranted)|\b(denied|not\s+granted|not\s+warranted)[^.\n]{0,120}(housebound|confined.*dwelling)/i.test(text);
      if (houseboundDenied) {
        return { status: 'not detected', reason: 'Housebound explicitly denied in decision text' };
      }

      // Explicit grant/award context only (mention alone is not enough)
      const houseboundGranted = /(housebound|confined.*dwelling)[^.\n]{0,120}(granted|awarded|established)|\b(granted|awarded|established)[^.\n]{0,120}(housebound|confined.*dwelling)/i.test(text);
      const explicitHousebound = /housebound|confined.*dwelling/i.test(text);
      if (explicitHousebound && houseboundGranted) {
        return { status: 'eligible', reason: 'Housebound explicitly granted', evidence: 'Housebound grant language found' };
      }
      
      // Inferred from ratings
      const has100 = conditions.some(c => c.percentage >= 100);
      const additionalRating = conditions.filter(c => c.percentage < 100).reduce((sum, c) => sum + c.percentage, 0);
      
      if (has100 && additionalRating >= 60) {
        return { 
          status: 'inferred eligible', 
          reason: '100% + 60%+ additional may qualify for housebound', 
          evidence: 'Rating criteria met',
          cfr: '38 CFR 3.351(a)',
          note: 'Requires evidence of confinement to dwelling'
        };
      }
      
      return { status: 'not detected', reason: 'Rating criteria not met' };
    }
  },

  // Vocational Rehabilitation Triggers
  VOC_REHAB: {
    name: 'Vocational Rehabilitation & Employment (Chapter 31)',
    cfr: '38 CFR 21.1',
    eligibilityCriteria: [
      '10% or more service-connected disability',
      'Employment handicap or serious employment handicap'
    ],
    keywords: ['vocational rehabilitation', 'Chapter 31', 'voc rehab', 'employment services'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      // Explicit mention
      const explicitVocRehab = /vocational\s*rehabilitation|chapter\s*31|voc\s*rehab/i.test(text);
      if (explicitVocRehab) {
        return { status: 'eligible', reason: 'Voc Rehab mentioned', evidence: 'Chapter 31 language found' };
      }
      
      // Inferred from 10%+ rating
      const maxRating = Math.max(...conditions.map(c => c.percentage || 0));
      if (maxRating >= 10) {
        return { 
          status: 'inferred eligible', 
          reason: '10%+ rating triggers Voc Rehab eligibility', 
          evidence: `${maxRating}% service-connected disability`,
          cfr: '38 CFR 21.1',
          note: 'Requires determination of employment handicap'
        };
      }
      
      return { status: 'not detected', reason: 'No 10%+ rating' };
    }
  },

  // CRDP - Concurrent Retirement and Disability Pay
  CRDP: {
    name: 'Concurrent Retirement and Disability Pay',
    cfr: '10 USC 1414',
    eligibilityCriteria: [
      'Military retiree',
      '50% or more VA disability rating',
      '20+ years of service OR medically retired'
    ],
    keywords: ['CRDP', 'concurrent retirement', 'disability pay'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      const explicitCRDP = /\bCRDP\b|concurrent\s*retirement/i.test(text);
      if (explicitCRDP) {
        return { status: 'eligible', reason: 'CRDP mentioned', evidence: 'CRDP language found' };
      }
      
      // Inferred from 50%+ rating (if retiree)
      const combinedRating = parseInt(metadata?.combinedRating || '0');
      if (combinedRating >= 50 && /retire/i.test(text)) {
        return { 
          status: 'inferred eligible', 
          reason: '50%+ rating + retirement may qualify for CRDP', 
          evidence: `${combinedRating}% combined rating`,
          cfr: '10 USC 1414',
          note: 'Requires 20+ years service or medical retirement'
        };
      }
      
      return { status: 'not detected', reason: 'Not 50%+ or no retirement detected' };
    }
  },

  // CRSC - Combat-Related Special Compensation
  CRSC: {
    name: 'Combat-Related Special Compensation',
    cfr: '10 USC 1413a',
    eligibilityCriteria: [
      'Military retiree',
      'Combat-related VA disability',
      '10% or more VA rating'
    ],
    keywords: ['CRSC', 'combat-related special compensation', 'combat injury'],
    detectFunc: (conditions, metadata, fullText = '') => {
      const text = fullText.toLowerCase();
      
      const explicitCRSC = /\bCRSC\b|combat.*related.*special.*compensation/i.test(text);
      if (explicitCRSC) {
        return { status: 'eligible', reason: 'CRSC mentioned', evidence: 'CRSC language found' };
      }
      
      // Inferred from combat language + rating
      const hasCombatLanguage = /combat|hostile.*fire|line.*duty|enemy.*engagement/i.test(text);
      const maxRating = Math.max(...conditions.map(c => c.percentage || 0));
      
      if (hasCombatLanguage && maxRating >= 10 && /retire/i.test(text)) {
        return { 
          status: 'inferred eligible', 
          reason: 'Combat-related disabilities + retirement may qualify', 
          evidence: 'Combat language + retirement detected',
          cfr: '10 USC 1413a',
          note: 'Requires combat-related determination'
        };
      }
      
      return { status: 'not detected', reason: 'No combat-related + retirement detected' };
    }
  }
};

/**
 * Detect all ancillary benefits from decision letter
 */
export function detectAncillaryBenefits(conditions = [], metadata = {}, fullText = '') {
  const results = [];
  
  Object.entries(ANCILLARY_BENEFITS_RULES).forEach(([key, benefit]) => {
    if (benefit.detectFunc) {
      const detection = benefit.detectFunc(conditions, metadata, fullText);
      if (detection.status !== 'not detected') {
        results.push({
          benefit: benefit.name,
          ...detection,
          cfr: detection.cfr || benefit.cfr
        });
      }
    }
  });
  
  return results;
}

export default { ANCILLARY_BENEFITS_RULES, detectAncillaryBenefits };

