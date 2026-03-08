/**
 * DD-214 Military Discharge Document Scanner
 * Extracts service information from DD-214 text documents
 * Ported from Rally Forge1 Python scanner with enhancements
 */

import { preprocessScannerText } from "./scannerMiddleware.js";

/**
 * Extract service member name from DD-214
 */
const extractName = (text) => {
  const patterns = [
    // Block 4 format: "4. NAME (Last, First, Middle)"
    /4\.\s*NAME[^:]*:(.*?)(?:\n|5\.|DATE|BIRTH)/is,
    // Standard label format
    /NAME\s*OF\s*MEMBER[^:]*:(.*?)(?:\n|DATE|BIRTH|2\.|DEPARTMENT)/is,
    // Capitalized name near top (Last, First format)
    /(?:^|\n)\s*([A-Z]{2,},\s*[A-Z]{2,}(?:\s+[A-Z]\.?)?)\s*(?:\n|$)/m,
    // Alternative format with brackets or parentheses  
    /NAME[:\s]*\(Last[^)]+\)[:\s]*(.*?)(?:\n|DATE|SSN)/is
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let name = match[1].trim();
      // Clean up OCR artifacts
      name = name.replace(/[_=]+/g, '').replace(/\s+/g, ' ');
      // Remove common OCR artifacts and form numbers
      name = name.replace(/\b(?:DD|FORM|214|PAGE|BREAK)\b/gi, '');
      name = name.trim();
      // Validate name length and format
      if (name.length > 3 && name.length < 80 && /[A-Z]/.test(name)) {
        return name;
      }
    }
  }
  return null;
};

/**
 * Extract military branch
 */
const extractBranch = (text) => {
  const branchKeywords = {
    'Army': /\b(?:ARMY|USA|US ARMY|UNITED STATES ARMY)\b/i,
    'Navy': /\b(?:NAVY|USN|US NAVY|UNITED STATES NAVY)\b/i,
    'Air Force': /\b(?:AIR FORCE|USAF|US AIR FORCE|UNITED STATES AIR FORCE)\b/i,
    'Marine Corps': /\b(?:MARINE|MARINES|USMC|US MARINE CORPS|UNITED STATES MARINE CORPS)\b/i,
    'Coast Guard': /\b(?:COAST GUARD|USCG|US COAST GUARD|UNITED STATES COAST GUARD)\b/i,
    'Space Force': /\b(?:SPACE FORCE|USSF|US SPACE FORCE|UNITED STATES SPACE FORCE)\b/i
  };

  for (const [branch, pattern] of Object.entries(branchKeywords)) {
    if (pattern.test(text)) {
      return branch;
    }
  }
  return null;
};

/**
 * Extract service dates (entry and separation)
 */
const extractServiceDates = (text) => {
  const result = {
    entryDate: null,
    separationDate: null,
    yearsOfService: null
  };

  // Entry date patterns - looking for valid dates only
  const entryPatterns = [
    /Date entered AD.*?(\d{4})[\/\s](\d{2})[\/\s](\d{2})/i,
    /ENTRY.*?DUTY.*?(\d{4})[\/\-](\d{2})[\/\-](\d{2})/i,
    /7\.?a.*?ENTRY.*?(\d{4})[\/\-](\d{2})[\/\-](\d{2})/is
  ];

  for (const pattern of entryPatterns) {
    const match = text.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      // Validate date ranges
      if (year >= 1940 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        result.entryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        break;
      }
    }
  }

  // Separation date patterns
  const sepPatterns = [
    /Separation Date.*?(\d{4})[\/\s](\d{2})[\/\s](\d{2})/i,
    /DATE\s*OF\s*SEPARATION.*?(\d{4})[\/\-](\d{2})[\/\-](\d{2})/i,
  ];

  for (const pattern of sepPatterns) {
    const match = text.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      // Validate date ranges
      if (year >= 1940 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        result.separationDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        break;
      }
    }
  }

  // Calculate years of service
  const serviceYearsMatch = text.match(/(?:Total|Net).*?Active.*?Service.*?(\d+)\s*(?:years?|yrs?)/is);
  if (serviceYearsMatch) {
    const years = parseInt(serviceYearsMatch[1]);
    if (years >= 0 && years <= 50) {
      result.yearsOfService = years;
    }
  }

  return result;
};

/**
 * Extract rank and pay grade
 */
const extractRank = (text) => {
  const result = {
    rank: null,
    payGrade: null
  };

  // Pay grade patterns (E-1 through O-10, W-1 through W-5)
  const payGradePattern = /(?:PAY\s*GRADE|4b).*?([EOW][-\s]?\d{1,2})/is;
  const payGradeMatch = text.match(payGradePattern);
  if (payGradeMatch) {
    const grade = payGradeMatch[1].toUpperCase().replace(/\s+/g, '-');
    const gradeNum = parseInt(grade.match(/\d+/)[0]);
    // Validate pay grade ranges: E1-E9, O1-O10, W1-W5
    if ((grade.startsWith('E') && gradeNum >= 1 && gradeNum <= 9) ||
        (grade.startsWith('O') && gradeNum >= 1 && gradeNum <= 10) ||
        (grade.startsWith('W') && gradeNum >= 1 && gradeNum <= 5)) {
      result.payGrade = grade;
    }
  }

  // Rank title patterns
  const rankPatterns = [
    // Block 4a format
    /4a\.?\s*(?:GRADE|RATE|RANK)[:\s]+([A-Z][A-Z0-9\s\/]+?)(?:\n|4b|PAY)/is,
    // Standard label format
    /(?:GRADE|RANK|RATE)[:\s]+([A-Z][A-Z0-9\s\/]+?)(?:\n|PAY\s*GRADE|4b)/is,
    // Rank before pay grade
    /([A-Z][A-Z\s]{2,30}?)(?:\s+[EOW]-?\d)/i
  ];

  for (const pattern of rankPatterns) {
    const match = text.match(pattern);
    if (match) {
      let rank = match[1].trim();
      rank = rank.replace(/[_=]+/g, '').replace(/\s+/g, ' ');
      // Remove common OCR artifacts
      rank = rank.replace(/\b(?:PAY|GRADE|4B|BLOCK)\b/gi, '');
      rank = rank.trim();
      // Validate rank
      if (rank.length > 2 && rank.length < 50 && /^[A-Z]/.test(rank)) {
        result.rank = rank;
        break;
      }
    }
  }

  return result;
};

/**
 * Extract MOS/Specialty codes
 */
const extractMOS = (text) => {
  const mosList = [];
  
  // MOS pattern: typically alphanumeric codes like "92R1P", "11B", "0311"
  const mosPatterns = [
    /(?:MOS|SPECIALTY|PRIMARY).*?:\s*(\d{2,4}[A-Z0-9]*)/gis,
    /\b(\d{2,4}[A-Z]{1,3})\s+(?:[A-Z][A-Z\s]+?)(?:\-\-|\n)/g,
    /11\.\s*PRIMARY.*?(\d{2,4}[A-Z0-9]+)/gis
  ];

  for (const pattern of mosPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const mos = match[1].trim();
      // Filter out obviously invalid MOS codes (too long, contains spaces, etc.)
      if (mos && mos.length <= 10 && !mos.includes(' ') && !mosList.includes(mos)) {
        mosList.push(mos);
      }
    }
  }

  // Extract specialist titles
  const specialtyPattern = /PRIMARY\s*SPECIALTY.*?:(.*?)(?:\n|Years|\/\/)/is;
  const specialtyMatch = text.match(specialtyPattern);
  let specialtyTitle = null;
  if (specialtyMatch) {
    specialtyTitle = specialtyMatch[1].trim().replace(/\d+[A-Z0-9]+\s*/, '');
  }

  return {
    codes: mosList,
    title: specialtyTitle
  };
};

/**
 * Extract awards and decorations
 */
const extractAwards = (text) => {
  const awards = [];
  const combatAwards = [];

  // Awards section (Block 13)
  const awardsSection = text.match(/13\.\s*DECORATIONS.*?:(.*?)(?:14\.|MILITARY\s*EDUCATION|$)/is);
  if (!awardsSection) return { awards, combatAwards };

  const awardsText = awardsSection[1];

  // Known combat awards
  const combatKeywords = [
    'PURPLE HEART',
    'BRONZE STAR',
    'SILVER STAR',
    'COMBAT INFANTRY',
    'COMBAT ACTION',
    'COMBAT MEDICAL',
    'ARMY COMMENDATION MEDAL WITH V',
    'NAVY COMMENDATION MEDAL WITH V'
  ];

  // Split by // or similar delimiters
  const awardList = awardsText.split(/\/\/|;|\n/).map(a => a.trim()).filter(Boolean);

  for (const award of awardList) {
    const cleanAward = award.replace(/[_=]+/g, '').trim();
    // Filter out obviously invalid awards (too short, too long, contains numbers at start, etc.)
    const isValidAward = cleanAward && 
                         cleanAward !== 'NOTHING FOLLOWS' && 
                         cleanAward.length > 5 && 
                         cleanAward.length < 150 &&
                         !/^\d+/.test(cleanAward) && // doesn't start with number
                         /[A-Z]/.test(cleanAward); // contains at least one letter
    
    if (isValidAward) {
      awards.push(cleanAward);
      
      // Check if it's a combat award
      if (combatKeywords.some(keyword => cleanAward.toUpperCase().includes(keyword))) {
        combatAwards.push(cleanAward);
      }
    }
  }

  return { awards, combatAwards };
};

/**
 * Extract discharge/separation information
 */
const extractDischargeInfo = (text) => {
  const result = {
    characterOfService: null,
    separationCode: null,
    narrativeReason: null
  };

  // Character of service (Block 24)
  const characterPatterns = [
    /24\.\s*CHARACTER.*?SERVICE.*?:\s*([A-Z][A-Za-z\s]+?)(?:\n|25\.|$)/is,
    /CHARACTER.*?SERVICE.*?:\s*(HONORABLE|GENERAL|UNDER HONORABLE|OTHER THAN HONORABLE|BAD CONDUCT|DISHONORABLE)/is
  ];

  for (const pattern of characterPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.characterOfService = match[1].trim();
      break;
    }
  }

  // Separation code (Block 26)
  const sepCodePattern = /26\.\s*SEPARATION\s*CODE.*?:\s*([A-Z0-9]{2,4})/is;
  const sepCodeMatch = text.match(sepCodePattern);
  if (sepCodeMatch) {
    result.separationCode = sepCodeMatch[1].trim();
  }

  // Narrative reason (Block 28)
  const narrativePattern = /28\.\s*NARRATIVE.*?SEPARATION.*?:\s*(.*?)(?:\n|29\.|$)/is;
  const narrativeMatch = text.match(narrativePattern);
  if (narrativeMatch) {
    result.narrativeReason = narrativeMatch[1].trim().replace(/[_=]+/g, '');
  }

  return result;
};

/**
 * Detect combat service indicators
 */
const detectCombatService = (text, awards) => {
  const combatIndicators = {
    hasCombatAwards: awards.combatAwards.length > 0,
    combatLocations: [],
    combatTheaters: []
  };

  // Known combat zones/conflicts
  const combatZones = [
    { name: 'Iraq', pattern: /\b(?:IRAQ|OIF|OPERATION IRAQI FREEDOM)\b/i },
    { name: 'Afghanistan', pattern: /\b(?:AFGHANISTAN|OEF|OPERATION ENDURING FREEDOM)\b/i },
    { name: 'Vietnam', pattern: /\b(?:VIETNAM|VIETNAMESE)\b/i },
    { name: 'Korea', pattern: /\b(?:KOREA|KOREAN)\b/i },
    { name: 'Gulf War', pattern: /\b(?:DESERT STORM|DESERT SHIELD|GULF WAR)\b/i },
    { name: 'Somalia', pattern: /\b(?:SOMALIA|MOGADISHU)\b/i }
  ];

  for (const zone of combatZones) {
    if (zone.pattern.test(text)) {
      combatIndicators.combatLocations.push(zone.name);
    }
  }

  return combatIndicators;
};

/**
 * Main DD-214 scanner function
 */
export const parseDD214 = (rawText) => {
  const preprocessedText = preprocessScannerText(rawText);
  
  const name = extractName(preprocessedText);
  const branch = extractBranch(preprocessedText);
  const serviceDates = extractServiceDates(preprocessedText);
  const rankInfo = extractRank(preprocessedText);
  const mosInfo = extractMOS(preprocessedText);
  const awardsInfo = extractAwards(preprocessedText);
  const dischargeInfo = extractDischargeInfo(preprocessedText);
  const combatInfo = detectCombatService(preprocessedText, awardsInfo);

  // Calculate extraction confidence
  const extractedFields = [
    name,
    branch,
    serviceDates.entryDate,
    serviceDates.separationDate,
    rankInfo.rank,
    rankInfo.payGrade,
    mosInfo.codes.length > 0,
    awardsInfo.awards.length > 0,
    dischargeInfo.characterOfService
  ].filter(Boolean).length;

  const confidence = extractedFields / 9;

  return {
    documentType: 'DD-214',
    veteran: {
      name,
      branch,
      entryDate: serviceDates.entryDate,
      separationDate: serviceDates.separationDate,
      yearsOfService: serviceDates.yearsOfService,
      rank: rankInfo.rank,
      payGrade: rankInfo.payGrade,
      mosCode: mosInfo.codes[0] || null,
      mosCodes: mosInfo.codes,
      specialtyTitle: mosInfo.title,
      characterOfService: dischargeInfo.characterOfService,
      separationCode: dischargeInfo.separationCode,
      narrativeReason: dischargeInfo.narrativeReason
    },
    awards: awardsInfo.awards,
    combatAwards: awardsInfo.combatAwards,
    combatService: combatInfo,
    extractionConfidence: confidence,
    rawText: rawText.substring(0, 500) // Store snippet for debugging
  };
};

export default parseDD214;

