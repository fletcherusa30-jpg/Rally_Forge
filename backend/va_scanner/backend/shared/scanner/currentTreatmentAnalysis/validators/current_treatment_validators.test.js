'use strict';

const CurrentTreatmentValidators = require('../validators/current_treatment_validators');

/**
 * Test Suite: Current Treatment Record Validators
 * Tests comprehensive validation of extracted active treatment data
 */

describe('CurrentTreatmentValidators', () => {
  let validators;

  beforeEach(() => {
    validators = new CurrentTreatmentValidators({
      strictMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
  });

  describe('validateCurrentTreatmentExtraction', () => {
    it('should validate complete current treatment extraction', () => {
      const completeCTR = {
        _metadata: {
          scannerId: 'ctr-001',
          extractionDate: '2024-01-15',
          reportDate: '2024-01-10'
        },
        activeConditions: [
          {
            conditionName: 'Generalized Anxiety Disorder',
            diagnosisCode: 'F41.1',
            status: 'Active',
            severity: 'Moderate',
            onsetDate: '2015-06-20'
          }
        ],
        currentMedications: [
          {
            medicationName: 'Sertraline',
            dosage: '100mg',
            frequency: 'Daily',
            route: 'Oral',
            indication: 'PTSD',
            startDate: '2023-01-15'
          }
        ]
      };

      const result = validators.validateCurrentTreatmentExtraction(completeCTR);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PASS');
    });

    it('should fail when active conditions array is missing', () => {
      const incompleteCTR = {
        _metadata: {
          scannerId: 'ctr-001',
          extractionDate: '2024-01-15'
        }
      };

      const result = validators.validateCurrentTreatmentExtraction(incompleteCTR);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing activeConditions array');
    });

    it('should warn on outdated report', () => {
      const outdatedCTR = {
        _metadata: {
          scannerId: 'ctr-001',
          extractionDate: '2024-01-15',
          reportDate: '2022-01-10'  // Over 2 years old
        },
        activeConditions: []
      };

      const result = validators.validateCurrentTreatmentExtraction(outdatedCTR);

      expect(result.warnings).toBeDefined();
    });
  });

  describe('validateActiveConditions', () => {
    it('should validate active conditions', () => {
      const conditions = [
        {
          conditionName: 'Hypertension',
          diagnosisCode: 'I10',
          status: 'Chronic',
          severity: 'Moderate',
          onsetDate: '2010-05-15'
        }
      ];

      const result = validators.validateActiveConditions(conditions);

      expect(result.errors.length).toBe(0);
    });

    it('should detect duplicate conditions', () => {
      const conditions = [
        {
          conditionName: 'PTSD',
          diagnosisCode: 'F43.10',
          status: 'Active',
          severity: 'Moderate'
        },
        {
          conditionName: 'PTSD',
          diagnosisCode: 'F43.10',
          status: 'Active',
          severity: 'Moderate'
        }
      ];

      const result = validators.validateActiveConditions(conditions);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject invalid ICD codes', () => {
      const conditions = [
        {
          conditionName: 'Invalid',
          diagnosisCode: 'INVALID123',
          status: 'Active'
        }
      ];

      const result = validators.validateActiveConditions(conditions);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid status values', () => {
      const conditions = [
        {
          conditionName: 'PTSD',
          diagnosisCode: 'F43.10',
          status: 'Unknown Status',
          severity: 'Moderate'
        }
      ];

      const result = validators.validateActiveConditions(conditions);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateMedications', () => {
    it('should validate current medications', () => {
      const medications = [
        {
          medicationName: 'Sertraline',
          dosage: '100mg',
          frequency: 'Daily',
          route: 'Oral',
          indication: 'PTSD',
          startDate: '2023-01-15'
        }
      ];

      const result = validators.validateMedications(medications);

      expect(result.errors.length).toBe(0);
    });

    it('should detect duplicate medications', () => {
      const medications = [
        {
          medicationName: 'Sertraline',
          dosage: '100mg',
          frequency: 'Daily',
          route: 'Oral'
        },
        {
          medicationName: 'Sertraline',
          dosage: '100mg',
          frequency: 'Daily',
          route: 'Oral'
        }
      ];

      const result = validators.validateMedications(medications);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject invalid medication routes', () => {
      const medications = [
        {
          medicationName: 'Aspirin',
          dosage: '325mg',
          frequency: 'Daily',
          route: 'Holographic'  // Invalid route
        }
      ];

      const result = validators.validateMedications(medications);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn on unclear medication frequency', () => {
      const medications = [
        {
          medicationName: 'Ibuprofen',
          dosage: '400mg',
          frequency: 'Sometimes',  // Unclear
          route: 'Oral'
        }
      ];

      const result = validators.validateMedications(medications);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateFunctionalImpairments', () => {
    it('should validate functional impairments', () => {
      const impairments = [
        {
          activityCategory: 'Ambulation',
          severity: 'Moderate',
          functionalLimitation: 'Unable to walk more than 100 feet'
        }
      ];

      const result = validators.validateFunctionalImpairments(impairments);

      expect(result.errors.length).toBe(0);
    });

    it('should flag unusual activity categories', () => {
      const impairments = [
        {
          activityCategory: 'Telepathy',
          severity: 'Severe',
          functionalLimitation: 'Cannot read minds'
        }
      ];

      const result = validators.validateFunctionalImpairments(impairments);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject unclear severity levels', () => {
      const impairments = [
        {
          activityCategory: 'Vision',
          severity: 'Kind of Bad',
          functionalLimitation: 'Limited vision'
        }
      ];

      const result = validators.validateFunctionalImpairments(impairments);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateSymptoms', () => {
    it('should validate symptoms and complaints', () => {
      const symptoms = [
        {
          symptomName: 'Nightmares',
          duration: '5 years',
          severity: 'Moderate',
          onsetDate: '2019-01-15'
        }
      ];

      const result = validators.validateSymptoms(symptoms);

      expect(result.errors.length).toBe(0);
    });

    it('should reject unclear symptom severity', () => {
      const symptoms = [
        {
          symptomName: 'Headache',
          duration: 'Chronic',
          severity: 'Pretty Bad'
        }
      ];

      const result = validators.validateSymptoms(symptoms);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateTreatingProviders', () => {
    it('should validate treating providers', () => {
      const providers = [
        {
          providerName: 'Dr. Smith',
          specialty: 'Psychiatry',
          facility: 'VA Medical Center',
          lastVisitDate: '2024-01-10'
        }
      ];

      const result = validators.validateTreatingProviders(providers);

      expect(result.errors.length).toBe(0);
    });

    it('should warn when no providers documented', () => {
      const providers = [];

      const result = validators.validateTreatingProviders(providers);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateVitalSigns', () => {
    it('should validate normal vital signs', () => {
      const vitals = {
        measurementDate: '2024-01-10',
        bloodPressure: '120/80',
        heartRate: 72,
        temperature: 98.6
      };

      const result = validators.validateVitalSigns(vitals);

      expect(result.errors.length).toBe(0);
    });

    it('should warn on unusual blood pressure', () => {
      const vitals = {
        measurementDate: '2024-01-10',
        bloodPressure: '220/140'  // Very high
      };

      const result = validators.validateVitalSigns(vitals);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on unusual heart rate', () => {
      const vitals = {
        measurementDate: '2024-01-10',
        heartRate: 150  // Elevated
      };

      const result = validators.validateVitalSigns(vitals);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
