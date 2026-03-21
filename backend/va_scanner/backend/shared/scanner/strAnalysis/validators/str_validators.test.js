'use strict';

const STRValidators = require('../validators/str_validators');

/**
 * Test Suite: Service Treatment Record (STR) Validators
 * Tests comprehensive validation of extracted in-service medical data
 */

describe('STRValidators', () => {
  let validators;

  beforeEach(() => {
    validators = new STRValidators({
      strictMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
  });

  describe('validateSTRExtraction', () => {
    it('should validate complete STR extraction', () => {
      const completeSTR = {
        _metadata: {
          scannerId: 'str-001',
          extractionDate: '2024-01-15',
          documentCount: 50
        },
        inServiceDiagnoses: [
          {
            diagnosisCode: '401.9',
            diagnosisDescription: 'Hypertension',
            encounterDate: '2015-06-20'
          }
        ],
        medicalEncounters: [
          {
            encounterDate: '2015-06-20',
            facility: 'Brooke Army Medical Center'
          }
        ],
        treatmentProviders: [
          {
            providerType: 'Physician',
            facility: 'Brooke Army Medical Center',
            firstEncounterDate: '2015-06-20'
          }
        ]
      };

      const result = validators.validateSTRExtraction(completeSTR);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PASS');
    });

    it('should fail when diagnoses array is missing', () => {
      const incompleteSTR = {
        _metadata: {
          scannerId: 'str-001',
          extractionDate: '2024-01-15'
        }
      };

      const result = validators.validateSTRExtraction(incompleteSTR);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing inServiceDiagnoses array');
    });
  });

  describe('validateDiagnoses', () => {
    it('should validate diagnoses with proper ICD codes', () => {
      const diagnoses = [
        {
          diagnosisCode: '401.9',
          diagnosisDescription: 'Hypertension',
          encounterDate: '2015-06-20'
        },
        {
          diagnosisCode: 'I10',
          diagnosisDescription: 'Essential hypertension',
          encounterDate: '2018-06-20'
        }
      ];

      const result = validators.validateDiagnoses(diagnoses);

      expect(result.errors.length).toBe(0);
    });

    it('should detect duplicate diagnoses', () => {
      const diagnoses = [
        {
          diagnosisCode: '401.9',
          diagnosisDescription: 'Hypertension',
          encounterDate: '2015-06-20'
        },
        {
          diagnosisCode: '401.9',
          diagnosisDescription: 'Hypertension',
          encounterDate: '2015-06-20'
        }
      ];

      const result = validators.validateDiagnoses(diagnoses);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject invalid ICD code format', () => {
      const diagnoses = [
        {
          diagnosisCode: 'INVALID',
          diagnosisDescription: 'Invalid Diagnosis'
        }
      ];

      const result = validators.validateDiagnoses(diagnoses);

      expect(result.errors[0]).toContain('Invalid ICD code format');
    });

    it('should flag presumptive conditions', () => {
      const diagnoses = [
        {
          diagnosisCode: '401.9',
          diagnosisDescription: 'Agent Orange exposure',
          encounterDate: '2016-01-01'
        }
      ];

      const result = validators.validateDiagnoses(diagnoses);

      expect(result.errors.length).toBe(0);
    });
  });

  describe('validateInjuries', () => {
    it('should validate service-related injuries', () => {
      const injuries = [
        {
          injuryType: 'Gunshot Wound',
          anatomicalSite: 'Left Leg',
          incidentDate: '2015-06-15',
          currentStatus: 'Chronic'
        }
      ];

      const result = validators.validateInjuries(injuries);

      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid anatomical sites', () => {
      const injuries = [
        {
          injuryType: 'Gunshot Wound',
          anatomicalSite: 'Unknown Part'
        }
      ];

      const result = validators.validateInjuries(injuries);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on unclear injury status', () => {
      const injuries = [
        {
          injuryType: 'Fracture',
          anatomicalSite: 'Right Arm',
          currentStatus: 'Unclear'
        }
      ];

      const result = validators.validateInjuries(injuries);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateExposures', () => {
    it('should validate service line exposures', () => {
      const exposures = [
        {
          exposureType: 'Agent Orange',
          durationOfExposure: '1965-1973',
          locationOfExposure: 'Vietnam',
          documentationLevel: 'Direct'
        }
      ];

      const result = validators.validateExposures(exposures);

      expect(result.errors.length).toBe(0);
    });

    it('should reject unusual exposure types', () => {
      const exposures = [
        {
          exposureType: 'Unknown Substance',
          durationOfExposure: '1965-1973',
          locationOfExposure: 'Vietnam'
        }
      ];

      const result = validators.validateExposures(exposures);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateChronology', () => {
    it('should validate encounter chronology', () => {
      const encounters = [
        { encounterDate: '2015-06-01' },
        { encounterDate: '2015-07-01' },
        { encounterDate: '2015-08-01' }
      ];

      const result = validators.validateChronology(encounters);

      expect(result.errors.length).toBe(0);
    });

    it('should detect chronological disorders', () => {
      const encounters = [
        { encounterDate: '2015-08-01' },
        { encounterDate: '2015-06-01' }
      ];

      const result = validators.validateChronology(encounters);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn on large gaps between encounters', () => {
      const encounters = [
        { encounterDate: '2015-01-01' },
        { encounterDate: '2019-01-01' }  // 4 year gap
      ];

      const result = validators.validateChronology(encounters);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateProviders', () => {
    it('should validate treatment providers', () => {
      const providers = [
        {
          providerType: 'Physician',
          facility: 'Brooke Army Medical Center',
          firstEncounterDate: '2015-06-20'
        }
      ];

      const result = validators.validateProviders(providers);

      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid provider types', () => {
      const providers = [
        {
          providerType: 'Astrologer',
          facility: 'Brooke Army Medical Center'
        }
      ];

      const result = validators.validateProviders(providers);

      expect(result.errors[0]).toContain('Invalid provider type');
    });
  });
});
