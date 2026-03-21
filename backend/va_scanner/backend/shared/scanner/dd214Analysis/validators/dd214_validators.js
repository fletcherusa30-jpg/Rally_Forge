'use strict';

/**
 * DD-214 Discharge Paper Validators
 * Validates extracted service history data from DD-214 documents
 */

class DD214Validators {
  constructor(config = {}) {
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.strictMode = config.strictMode !== false;
  }

  /**
   * Validate complete DD-214 extraction output
   * @param {Object} dd214Output - Extracted DD-214 data
   * @returns {Object} {isValid: boolean, errors: Array, warnings: Array}
   */
  validateDD214Extraction(dd214Output) {
    const errors = [];
    const warnings = [];

    this.logger.info('Beginning DD-214 extraction validation');

    // Validate personal information
    if (!dd214Output.personalInfo) {
      errors.push('Missing personalInfo object');
    } else {
      const piValidation = this.validatePersonalInfo(dd214Output.personalInfo);
      errors.push(...piValidation.errors);
      warnings.push(...piValidation.warnings);
    }

    // Validate service dates
    if (!dd214Output.serviceDates) {
      errors.push('Missing serviceDates object');
    } else {
      const sdValidation = this.validateServiceDates(dd214Output.serviceDates);
      errors.push(...sdValidation.errors);
      warnings.push(...sdValidation.warnings);
    }

    // Validate pay grade rank
    if (!dd214Output.payGradeRank) {
      errors.push('Missing payGradeRank object');
    } else {
      const pgrValidation = this.validatePayGradeRank(dd214Output.payGradeRank);
      errors.push(...pgrValidation.errors);
      warnings.push(...pgrValidation.warnings);
    }

    // Validate military occupational specialty
    if (dd214Output.militaryOccupationalSpecialty) {
      const mosValidation = this.validateMOS(dd214Output.militaryOccupationalSpecialty);
      errors.push(...mosValidation.errors);
      warnings.push(...mosValidation.warnings);
    }

    // Validate awards and decorations
    if (dd214Output.awardsMedalsDecorations && Array.isArray(dd214Output.awardsMedalsDecorations)) {
      const awardsValidation = this.validateAwards(dd214Output.awardsMedalsDecorations);
      errors.push(...awardsValidation.errors);
      warnings.push(...awardsValidation.warnings);
    }

    // Validate character of service
    if (dd214Output.characterOfService) {
      const cosValidation = this.validateCharacterOfService(dd214Output.characterOfService);
      errors.push(...cosValidation.errors);
      warnings.push(...cosValidation.warnings);
    }

    // Validate separation codes
    if (dd214Output.separationCodes) {
      const scValidation = this.validateSeparationCodes(dd214Output.separationCodes);
      errors.push(...scValidation.errors);
      warnings.push(...scValidation.warnings);
    }

    const isValid = errors.length === 0;
    this.logger.info(`DD-214 validation: ${isValid ? 'PASS' : 'FAIL'}`);

    return {
      isValid: isValid,
      status: isValid ? 'PASS' : 'FAIL',
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate personal information block
   */
  validatePersonalInfo(personalInfo) {
    const errors = [];
    const warnings = [];

    if (!personalInfo.fullName || personalInfo.fullName.trim().length === 0) {
      errors.push('Missing or empty full name');
    }

    if (!personalInfo.ssn || !/^\d{9}$/.test(personalInfo.ssn.replace(/-/g, ''))) {
      errors.push('Invalid SSN format');
    }

    if (!personalInfo.serviceNumber) {
      warnings.push('Missing service number');
    }

    if (!personalInfo.branch || !['Army', 'Navy', 'Air Force', 'Marines', 'Coast Guard', 'Space Force'].includes(personalInfo.branch)) {
      errors.push(`Invalid military branch: ${personalInfo.branch}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate service dates
   */
  validateServiceDates(serviceDates) {
    const errors = [];
    const warnings = [];

    if (!serviceDates.activeEntryDate || isNaN(Date.parse(serviceDates.activeEntryDate))) {
      errors.push('Invalid active entry date');
    }

    if (!serviceDates.separationDate || isNaN(Date.parse(serviceDates.separationDate))) {
      errors.push('Invalid separation date');
    }

    if (serviceDates.activeEntryDate && serviceDates.separationDate) {
      const entryDate = new Date(serviceDates.activeEntryDate);
      const sepDate = new Date(serviceDates.separationDate);

      if (entryDate >= sepDate) {
        errors.push('Entry date must be before separation date');
      }

      const yearsServed = (sepDate - entryDate) / (1000 * 60 * 60 * 24 * 365.25);
      if (yearsServed < 0.1) {
        errors.push('Service period too short (less than 36 days)');
      } else if (yearsServed < 2) {
        warnings.push(`Short service period: ${yearsServed.toFixed(2)} years`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate pay grade and rank
   */
  validatePayGradeRank(payGradeRank) {
    const errors = [];
    const warnings = [];

    if (!payGradeRank.payGrade || !/^[A-Z]+-\d+$/.test(payGradeRank.payGrade)) {
      errors.push(`Invalid pay grade format: ${payGradeRank.payGrade}`);
    }

    if (!payGradeRank.rank) {
      errors.push('Missing rank');
    }

    if (payGradeRank.payGrade && payGradeRank.rank) {
      const separator = payGradeRank.payGrade.charAt(0);
      if (separator === 'E' && !this.isEnlistedRank(payGradeRank.rank)) {
        warnings.push(`Enlisted pay grade but rank mismatch: ${payGradeRank.rank}`);
      }
      if (separator === 'O' && !this.isOfficerRank(payGradeRank.rank)) {
        warnings.push(`Officer pay grade but rank mismatch: ${payGradeRank.rank}`);
      }
    }

    return { errors, warnings };
  }

  isEnlistedRank(rank) {
    const enlistedRanks = ['PVT', 'PFC', 'SPD', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG', 'SMSG', 'CW2', 'CW3', 'CW4', 'CW5'];
    return enlistedRanks.includes(rank.toUpperCase());
  }

  isOfficerRank(rank) {
    const officerRanks = ['2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL', 'GEN', 'LTG', 'MG', 'BG', 'ADM', 'VADM', 'RADM', 'CDRE'];
    return officerRanks.includes(rank.toUpperCase());
  }

  /**
   * Validate military occupational specialty
   */
  validateMOS(mos) {
    const errors = [];
    const warnings = [];

    if (mos.primaryMOS) {
      if (!/^[A-Z0-9]{4,6}$/.test(mos.primaryMOS)) {
        errors.push(`Invalid primary MOS format: ${mos.primaryMOS}`);
      }
    }

    if (mos.additionalMOS && Array.isArray(mos.additionalMOS)) {
      for (const addlMos of mos.additionalMOS) {
        if (!/^[A-Z0-9]{4,6}$/.test(addlMos)) {
          errors.push(`Invalid additional MOS format: ${addlMos}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate awards and decorations
   */
  validateAwards(awards) {
    const errors = [];
    const warnings = [];

    if (awards.length === 0) {
      warnings.push('No awards or decorations found');
    }

    for (const award of awards) {
      if (!award.awardName) {
        errors.push('Award missing name');
      }

      if (award.issuanceDate && isNaN(Date.parse(award.issuanceDate))) {
        errors.push(`Invalid award issuance date: ${award.issuanceDate}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate character of service
   */
  validateCharacterOfService(cos) {
    const errors = [];
    const warnings = [];

    const validCharacters = ['Honorable', 'General Under Honorable', 'Other Than Honorable', 'Bad Conduct', 'Dishonorable'];

    if (!validCharacters.includes(cos.character)) {
      errors.push(`Invalid character of service: ${cos.character}`);
    }

    if (!cos.character.includes('Honorable')) {
      warnings.push(`Non-honorable discharge character: ${cos.character}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate separation codes (SPD/RE)
   */
  validateSeparationCodes(codes) {
    const errors = [];
    const warnings = [];

    if (!codes.separationProgramCode || !/^[A-R].$/.test(codes.separationProgramCode)) {
      errors.push(`Invalid separation program code: ${codes.separationProgramCode}`);
    }

    if (!codes.reenlistmentCode || !/^[A-E].$/.test(codes.reenlistmentCode)) {
      errors.push(`Invalid reenlistment code: ${codes.reenlistmentCode}`);
    }

    // Validate SPD/RE combinations per military rules
    if (codes.separationProgramCode && codes.reenlistmentCode) {
      const invalidCombinations = [
        ['B', 'C'], ['B', 'D'], ['B', 'E']
      ];

      for (const [spd, re] of invalidCombinations) {
        if (codes.separationProgramCode.startsWith(spd) && codes.reenlistmentCode.startsWith(re)) {
          warnings.push(`Unusual SPD/RE combination: ${codes.separationProgramCode}/${codes.reenlistmentCode}`);
        }
      }
    }

    return { errors, warnings };
  }
}

module.exports = DD214Validators;
