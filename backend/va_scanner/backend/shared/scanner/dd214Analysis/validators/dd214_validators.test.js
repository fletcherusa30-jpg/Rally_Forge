'use strict';

const DD214Validators = require('../validators/dd214_validators');

/**
 * Test Suite: DD-214 Discharge Paper Validators
 * Tests comprehensive validation of extracted service history
 */

describe('DD214Validators', () => {
  let validators;

  beforeEach(() => {
    validators = new DD214Validators({
      strictMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
  });

  describe('validateDD214Extraction', () => {
    it('should validate complete DD-214 extraction', () => {
      const completeDD214 = {
        _metadata: { scannerId: 'dd214-001' },
        personalInfo: {
          fullName: 'John Doe',
          ssn: '123-45-6789',
          branch: 'Army'
        },
        serviceDates: {
          activeEntryDate: '2010-01-15',
          separationDate: '2020-12-31'
        },
        payGradeRank: {
          payGrade: 'E-5',
          rank: 'SGT'
        },
        characterOfService: {
          character: 'Honorable'
        },
        separationCodes: {
          separationProgramCode: 'A0',
          reenlistmentCode: 'A1'
        }
      };

      const result = validators.validateDD214Extraction(completeDD214);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PASS');
    });

    it('should fail when personal info is missing', () => {
      const incompleteDD214 = {
        serviceDates: {
          activeEntryDate: '2010-01-15',
          separationDate: '2020-12-31'
        }
      };

      const result = validators.validateDD214Extraction(incompleteDD214);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing personalInfo object');
    });
  });

  describe('validatePersonalInfo', () => {
    it('should validate personal information', () => {
      const personalInfo = {
        fullName: 'Jane Smith',
        ssn: '987-65-4321',
        branch: 'Navy'
      };

      const result = validators.validatePersonalInfo(personalInfo);

      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid SSN format', () => {
      const personalInfo = {
        fullName: 'Jane Smith',
        ssn: '123456789',  // Wrong format
        branch: 'Navy'
      };

      const result = validators.validatePersonalInfo(personalInfo);

      expect(result.errors[0]).toContain('Invalid SSN format');
    });

    it('should reject invalid branch', () => {
      const personalInfo = {
        fullName: 'Jane Smith',
        ssn: '123-45-6789',
        branch: 'Space Army'  // Invalid branch
      };

      const result = validators.validatePersonalInfo(personalInfo);

      expect(result.errors[0]).toContain('Invalid military branch');
    });
  });

  describe('validateServiceDates', () => {
    it('should validate service dates', () => {
      const serviceDates = {
        activeEntryDate: '2010-01-15',
        separationDate: '2020-12-31'
      };

      const result = validators.validateServiceDates(serviceDates);

      expect(result.errors.length).toBe(0);
    });

    it('should reject entry date after separation date', () => {
      const serviceDates = {
        activeEntryDate: '2020-12-31',
        separationDate: '2010-01-15'
      };

      const result = validators.validateServiceDates(serviceDates);

      expect(result.errors[0]).toContain('Entry date must be before separation date');
    });

    it('should warn on very short service periods', () => {
      const serviceDates = {
        activeEntryDate: '2020-01-01',
        separationDate: '2020-01-15'
      };

      const result = validators.validateServiceDates(serviceDates);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validatePayGradeRank', () => {
    it('should validate enlisted pay grade and rank', () => {
      const payGradeRank = {
        payGrade: 'E-5',
        rank: 'SGT'
      };

      const result = validators.validatePayGradeRank(payGradeRank);

      expect(result.errors.length).toBe(0);
    });

    it('should validate officer pay grade and rank', () => {
      const payGradeRank = {
        payGrade: 'O-3',
        rank: 'CPT'
      };

      const result = validators.validatePayGradeRank(payGradeRank);

      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid pay grade format', () => {
      const payGradeRank = {
        payGrade: 'E5',  // Missing hyphen
        rank: 'SGT'
      };

      const result = validators.validatePayGradeRank(payGradeRank);

      expect(result.errors[0]).toContain('Invalid pay grade format');
    });

    it('should warn on enlisted/officer mismatch', () => {
      const payGradeRank = {
        payGrade: 'E-5',
        rank: 'CPT'  // Officer rank
      };

      const result = validators.validatePayGradeRank(payGradeRank);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateMOS', () => {
    it('should validate MOS codes', () => {
      const mos = {
        primaryMOS: '68W',
        additionalMOS: ['11B', '68W40']
      };

      const result = validators.validateMOS(mos);

      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid MOS format', () => {
      const mos = {
        primaryMOS: '6-8-W',  // Invalid format
        additionalMOS: []
      };

      const result = validators.validateMOS(mos);

      expect(result.errors[0]).toContain('Invalid primary MOS format');
    });
  });

  describe('validateCharacterOfService', () => {
    it('should validate honorable discharge', () => {
      const cos = { character: 'Honorable' };

      const result = validators.validateCharacterOfService(cos);

      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid character', () => {
      const cos = { character: 'Supreme' };

      const result = validators.validateCharacterOfService(cos);

      expect(result.errors[0]).toContain('Invalid character of service');
    });

    it('should warn on non-honorable discharge', () => {
      const cos = { character: 'Other Than Honorable' };

      const result = validators.validateCharacterOfService(cos);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateSeparationCodes', () => {
    it('should validate separation codes', () => {
      const codes = {
        separationProgramCode: 'A0',
        reenlistmentCode: 'A1'
      };

      const result = validators.validateSeparationCodes(codes);

      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid SPD format', () => {
      const codes = {
        separationProgramCode: 'AA',  // Invalid format
        reenlistmentCode: 'A1'
      };

      const result = validators.validateSeparationCodes(codes);

      expect(result.errors[0]).toContain('Invalid separation program code');
    });
  });
});
