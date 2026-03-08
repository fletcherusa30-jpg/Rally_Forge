/**
 * Special Monthly Compensation (SMC) Detection Engine
 * Based on 38 CFR 3.350 and M21-1 guidance
 * 
 * SMC Levels: K, L, L½, M, M½, N, O, R1, R2, S, T
 */

export const SMC_RULES = {
  // SMC-K (38 CFR 3.350(b))
  'SMC-K': {
    level: 'K',
    cfr: '38 CFR 3.350(b)',
    criteria: [
      'Loss or loss of use of creative organ',
      'Deformity or disfigurement of reproductive organs',
      'Erectile dysfunction (if rated at 0% otherwise)'
    ],
    keywords: ['creative organ', 'reproductive', 'erectile dysfunction', 'impotence'],
    basePay: 'Base + SMC-K',
    detectFunc: (conditions, contextText = '') => {
      const text = (conditions.map(c => c.condition).join(' ') + ' ' + contextText).toLowerCase();
      
      // Check for erectile dysfunction
      const hasED = conditions.some(c => /erectile.*dysfunction/i.test(c.condition));
      
      // Check for reproductive/creative organ language
      const hasCreativeOrganLoss = /loss.*creative.*organ|loss.*use.*reproductive|deformity.*reproductive/i.test(text);
      
      if (hasED || hasCreativeOrganLoss) {
        return {
          level: 'K',
          reason: hasED ? 'Erectile dysfunction' : 'Loss of use of creative organ',
          cfr: '38 CFR 3.350(b)',
          evidence: hasED ? 'Erectile dysfunction condition present' : 'Creative organ language detected'
        };
      }
      return null;
    }
  },

  // SMC-L (38 CFR 3.350(a))
  'SMC-L': {
    level: 'L',
    cfr: '38 CFR 3.350(a)',
    criteria: [
      'Loss or loss of use of one hand',
      'Loss or loss of use of one foot',
      'Blindness in one eye with 5/200 or less',
      'Total deafness in both ears'
    ],
    keywords: ['loss of hand', 'loss of foot', 'amputation', 'blindness', 'deafness'],
    basePay: 'Base + SMC-L',
    detectFunc: (conditions, contextText = '') => {
      const text = (conditions.map(c => c.condition).join(' ') + ' ' + contextText).toLowerCase();
      
      // Check for amputation/loss of use
      const hasHandLoss = /loss.*hand|amputation.*hand|loss.*use.*hand/i.test(text);
      const hasFootLoss = /loss.*foot|amputation.*foot|loss.*use.*foot/i.test(text);
      const hasBlindness = /blind.*one.*eye|visual.*acuity.*5\/200|loss.*vision.*one.*eye/i.test(text);
      const hasDeafness = /total.*deaf.*both|deaf.*both.*ears/i.test(text);
      
      if (hasHandLoss) {
        return { level: 'L', reason: 'Loss or loss of use of hand', cfr: '38 CFR 3.350(a)(1)', evidence: 'Hand loss detected' };
      }
      if (hasFootLoss) {
        return { level: 'L', reason: 'Loss or loss of use of foot', cfr: '38 CFR 3.350(a)(2)', evidence: 'Foot loss detected' };
      }
      if (hasBlindness) {
        return { level: 'L', reason: 'Blindness in one eye', cfr: '38 CFR 3.350(a)(3)', evidence: 'Blindness criteria met' };
      }
      if (hasDeafness) {
        return { level: 'L', reason: 'Total deafness in both ears', cfr: '38 CFR 3.350(a)(4)', evidence: 'Deafness criteria met' };
      }
      
      return null;
    }
  },

  // SMC-L½ ("L and a half")
  'SMC-L½': {
    level: 'L½',
    cfr: '38 CFR 3.350(c)',
    criteria: [
      'Two or more SMC-L level disabilities',
      'E.g., loss of both hands, or loss of hand and foot, etc.'
    ],
    basePay: 'Base + SMC-L½'
  },

  // SMC-M (38 CFR 3.350(d))
  'SMC-M': {
    level: 'M',
    cfr: '38 CFR 3.350(d)',
    criteria: [
      'Loss or loss of use of both hands',
      'Loss or loss of use of both feet',
      'Loss or loss of use of one hand and one foot',
      'Blindness in both eyes with 5/200 or less'
    ],
    keywords: ['both hands', 'both feet', 'bilateral amputation', 'blindness both eyes'],
    basePay: 'Base + SMC-M',
    detectFunc: (conditions, contextText = '') => {
      const text = (conditions.map(c => c.condition).join(' ') + ' ' + contextText).toLowerCase();
      
      const hasBothHands = /both.*hands|bilateral.*hand.*loss/i.test(text);
      const hasBothFeet = /both.*feet|bilateral.*foot.*loss/i.test(text);
      const hasHandAndFoot = /hand.*and.*foot|foot.*and.*hand/i.test(text) && /loss|amputation/i.test(text);
      const hasBilateralBlindness = /blind.*both.*eyes|bilateral.*blindness/i.test(text);
      
      if (hasBothHands) {
        return { level: 'M', reason: 'Loss of both hands', cfr: '38 CFR 3.350(d)', evidence: 'Bilateral hand loss' };
      }
      if (hasBothFeet) {
        return { level: 'M', reason: 'Loss of both feet', cfr: '38 CFR 3.350(d)', evidence: 'Bilateral foot loss' };
      }
      if (hasHandAndFoot) {
        return { level: 'M', reason: 'Loss of hand and foot', cfr: '38 CFR 3.350(d)', evidence: 'Hand and foot loss' };
      }
      if (hasBilateralBlindness) {
        return { level: 'M', reason: 'Blindness in both eyes', cfr: '38 CFR 3.350(d)', evidence: 'Bilateral blindness' };
      }
      
      return null;
    }
  },

  // SMC-M½ ("M and a half")
  'SMC-M½': {
    level: 'M½',
    cfr: '38 CFR 3.350(e)',
    criteria: 'More extensive loss than SMC-M but not meeting SMC-N',
    basePay: 'Base + SMC-M½'
  },

  // SMC-N (38 CFR 3.350(f))
  'SMC-N': {
    level: 'N',
    cfr: '38 CFR 3.350(f)',
    criteria: [
      'Helplessness requiring aid and attendance',
      'Bedridden',
      'Nursing home care level',
      'Total blindness + severe loss of hand/foot'
    ],
    keywords: ['aid and attendance', 'bedridden', 'helpless', 'nursing home', 'total care'],
    basePay: 'Base + SMC-N',
    detectFunc: (conditions, contextText = '') => {
      const text = (conditions.map(c => c.condition).join(' ') + ' ' + contextText).toLowerCase();
      
      const hasAA = /aid.*attendance|a&a|bedridden|nursing.*home|total.*care|helpless/i.test(text);
      const hasSevereBlindness = /total.*blind|light.*perception.*only|no.*light.*perception/i.test(text);
      
      if (hasAA && hasSevereBlindness) {
        return { level: 'N', reason: 'Blindness + A&A', cfr: '38 CFR 3.350(f)', evidence: 'Total blindness with A&A' };
      }
      if (hasAA) {
        return { level: 'N', reason: 'Aid and attendance', cfr: '38 CFR 3.350(f)', evidence: 'A&A language detected' };
      }
      
      return null;
    }
  },

  // SMC-O (38 CFR 3.350(g))
  'SMC-O': {
    level: 'O',
    cfr: '38 CFR 3.350(g)',
    criteria: 'Higher-level aid and attendance - multiple amputations requiring constant care',
    basePay: 'Base + SMC-O'
  },

  // SMC-R1 (38 CFR 3.350(i))
  'SMC-R1': {
    level: 'R1',
    cfr: '38 CFR 3.350(i)(1)',
    criteria: 'Regular aid and attendance at intermediate rate',
    basePay: 'Base + SMC-R1'
  },

  // SMC-R2 (38 CFR 3.350(i))
  'SMC-R2': {
    level: 'R2',
    cfr: '38 CFR 3.350(i)(2)',
    criteria: 'Higher-level aid and attendance',
    basePay: 'Base + SMC-R2'
  },

  // SMC-S (38 CFR 3.350(h))
  'SMC-S': {
    level: 'S',
    cfr: '38 CFR 3.350(h)',
    criteria: [
      'Housebound',
      'One 100% disability + additional disabilities totaling 60%+',
      'Substantially confined to dwelling and immediate premises'
    ],
    keywords: ['housebound', 'confined to dwelling', 'substantially housebound'],
    basePay: 'Base + SMC-S',
    detectFunc: (conditions, contextText = '') => {
      const text = (conditions.map(c => c.condition).join(' ') + ' ' + contextText).toLowerCase();
      
      const hasHousebound = /housebound|confined.*dwelling|confined.*home|substantially.*confined/i.test(text);
      
      // Check rating thresholds: one 100% + others >= 60%
      const has100 = conditions.some(c => c.percentage >= 100);
      const otherRatings = conditions.filter(c => c.percentage < 100).reduce((sum, c) => sum + c.percentage, 0);
      const meetsRatingCriteria = has100 && otherRatings >= 60;
      
      if (hasHousebound) {
        return { level: 'S', reason: 'Housebound', cfr: '38 CFR 3.350(h)', evidence: 'Housebound language detected' };
      }
      if (meetsRatingCriteria && text.includes('housebound')) {
        return { level: 'S', reason: 'Rating criteria + housebound', cfr: '38 CFR 3.350(h)', evidence: '100% + 60% additional' };
      }
      
      return null;
    }
  },

  // SMC-T (38 CFR 3.350(j))
  'SMC-T': {
    level: 'T',
    cfr: '38 CFR 3.350(j)',
    criteria: [
      'Traumatic brain injury (TBI)',
      'In need of regular aid and attendance',
      'In need of supervision to protect from hazards'
    ],
    keywords: ['TBI', 'traumatic brain injury', 'supervision', 'protect from hazards'],
    basePay: 'Base + SMC-T',
    detectFunc: (conditions, contextText = '') => {
      const text = (conditions.map(c => c.condition).join(' ') + ' ' + contextText).toLowerCase();
      
      const hasTBI = /tbi|traumatic.*brain.*injury|brain.*trauma/i.test(text);
      const needsSupervision = /supervision|protect.*hazard|cognitive.*impair|memory.*loss|confusion/i.test(text);
      
      if (hasTBI && needsSupervision) {
        return { level: 'T', reason: 'TBI requiring supervision', cfr: '38 CFR 3.350(j)', evidence: 'TBI + supervision needs' };
      }
      
      return null;
    }
  }
};

/**
 * Detect all applicable SMC levels for a veteran's conditions
 * @param {Array} conditions - Array of condition objects with {condition, percentage, ...}
 * @param {String} fullText - Full decision letter text for context
 * @returns {Array} Array of detected SMC levels with reasons
 */
export function detectSMC(conditions = [], fullText = '') {
  const detectedSMC = [];
  
  // Run each SMC detector
  Object.values(SMC_RULES).forEach(rule => {
    if (rule.detectFunc) {
      const result = rule.detectFunc(conditions, fullText);
      if (result) {
        detectedSMC.push(result);
      }
    }
  });
  
  // Also check for explicit SMC mentions in text
  const explicitSMC = extractExplicitSMC(fullText);
  explicitSMC.forEach(smc => {
    // Add if not already detected
    if (!detectedSMC.some(d => d.level === smc.level)) {
      detectedSMC.push(smc);
    }
  });
  
  return detectedSMC;
}

/**
 * Extract explicitly mentioned SMC levels from text
 * Only returns SMC codes that appear in grant/effective date context, not denied
 */
function extractExplicitSMC(text) {
  const explicit = [];
  const smcLevels = ['K', 'L', 'M', 'N', 'O', 'R1', 'R2', 'S', 'T'];
  
  smcLevels.forEach(level => {
    // Look for explicit SMC-X or SMC X patterns
    const smcPattern = new RegExp(`SMC[- ]?${level}\\b`, 'gi');
    let match;
    
    while ((match = smcPattern.exec(text)) !== null) {
      const position = match.index;
      const contextStart = Math.max(0, position - 150);
      const contextEnd = Math.min(text.length, position + 150);
      const context = text.substring(contextStart, contextEnd);
      
      // Check if this SMC is in a GRANTED context
      const hasGrantedContext = /grant|effective|award|establish|entitle|you are|eligible|approval/i.test(context);
      
      // Check if it's explicitly DENIED
      const isDenied = /deny|denied|not.*grant|lack.*evidence|insufficient|no.*entitle|reject/i.test(context);
      
      // Only include if granted context exists and not denied
      if (hasGrantedContext && !isDenied) {
        // Avoid duplicates
        if (!explicit.some(e => e.level === level)) {
          explicit.push({
            level,
            reason: `Explicitly stated as SMC-${level} with grant context`,
            cfr: SMC_RULES[`SMC-${level}`]?.cfr || '38 CFR 3.350',
            evidence: 'Explicit mention near grant/effective date keywords'
          });
        }
      }
    }
  });
  
  return explicit;
}

/**
 * Infer SMC based on M21-1 duty to maximize benefits
 */
export function inferSMC(conditions, metadata, fullText) {
  const inferred = [];
  
  // Infer SMC-K if erectile dysfunction present
  const hasED = conditions.some(c => /erectile.*dysfunction/i.test(c.condition));
  if (hasED) {
    inferred.push({
      level: 'K',
      reason: 'Inferred from erectile dysfunction (M21-1 duty to maximize)',
      cfr: '38 CFR 3.350(b)',
      evidence: 'Erectile dysfunction condition present',
      inferred: true
    });
  }
  
  // Infer SMC-S if veteran is 100% P&T with additional disabilities >= 60%
  const isPT = /permanent.*total|p&?t/i.test(fullText);
  const has100 = conditions.some(c => c.percentage >= 100);
  const additionalRating = conditions.filter(c => c.percentage < 100).reduce((sum, c) => sum + c.percentage, 0);
  
  if (isPT && has100 && additionalRating >= 60) {
    inferred.push({
      level: 'S',
      reason: 'Inferred from P&T + additional 60%+ (possible housebound)',
      cfr: '38 CFR 3.350(h)',
      evidence: 'P&T with significant additional disabilities',
      inferred: true,
      note: 'Veteran may be eligible for housebound SMC - requires confirmation of confinement to dwelling'
    });
  }
  
  return inferred;
}

export default { SMC_RULES, detectSMC, inferSMC };

