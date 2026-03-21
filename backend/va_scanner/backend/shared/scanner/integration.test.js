'use strict';

const VADecisionScanner = require('../vaDecisionScanner');
const DD214Scanner = require('../../dd214Analysis/dd214Scanner');
const STRScanner = require('../../strAnalysis/strScanner');
const CurrentTreatmentScanner = require('../../currentTreatmentAnalysis/currentTreatmentScanner');

/**
 * Integration Test Suite: Complete Scanner Pipeline
 * Tests end-to-end workflows: extraction → validation → calculation → output
 */

describe('Scanner Integration Tests', () => {
  let ratingScanner, dd214Scanner, strScanner, ctrScanner;

  beforeEach(() => {
    ratingScanner = new VADecisionScanner();
    dd214Scanner = new DD214Scanner();
    strScanner = new STRScanner();
    ctrScanner = new CurrentTreatmentScanner();
  });

  describe('VA Rating Decision Scanner Integration', () => {
    it('should process complete rating decision with calculations', async () => {
      const completeDecision = {
        _metadata: {
          scannerId: 'va-rater-integration-001',
          decisionType: 'Initial',
          combinedRating: 50,
          separationDate: '2020-01-15',
          effectiveDate: '2023-01-15',
          decisionDate: '2023-02-01'
        },
        combinedRating: {
          percentage: 50,
          calculationMethod: 'VA Schedule 38 CFR §4.25'
        },
        serviceConnectedConditions: [
          {
            conditionName: 'PTSD',
            diagnosticCode: '307001',
            currentRatingPercentage: 40,
            effectiveDate: '2023-01-15',
            serviceConnected: true
          },
          {
            conditionName: 'Lower Back Strain',
            diagnosticCode: '846000',
            currentRatingPercentage: 20,
            effectiveDate: '2023-01-15',
            serviceConnected: true
          }
        ],
        specialMonthlyCompensation: [
          {
            smcCode: 'A',
            effectiveDate: '2023-01-15',
            monthlyAmount: 150.00
          }
        ]
      };

      const result = await ratingScanner.processRatingDecision(completeDecision);

      // Verify success
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);

      // Verify calculations were performed
      expect(result.calculations).toBeDefined();
      expect(result.calculations.combinedRating).toBeDefined();

      // Verify combined rating calculation
      const crCalc = result.calculations.combinedRating;
      expect(crCalc.combinedRating).toBeGreaterThanOrEqual(0);
      expect(crCalc.combinedRating).toBeLessThanOrEqual(100);
    });

    it('should fail gracefully on invalid combined rating', async () => {
      const invalidDecision = {
        _metadata: {
          scannerId: 'va-rater-integration-002',
          decisionType: 'Initial'
        },
        serviceConnectedConditions: [
          {
            conditionName: 'PTSD',
            diagnosticCode: '307001',
            currentRatingPercentage: 50,  // Invalid percentage
            serviceConnected: true
          }
        ]
      };

      const result = await ratingScanner.processRatingDecision(invalidDecision);

      // Should fail validation but not crash
      expect(result.success).toBe(false);
      expect(result.validation).toBeDefined();
      expect(result.errorDetails).toBeDefined();
    });
  });

  describe('DD-214 Scanner Integration', () => {
    it('should scan complete DD-214 and calculate tenure metrics', async () => {
      const completeDD214 = {
        _metadata: { scannerId: 'dd214-integration-001' },
        personalInfo: {
          fullName: 'John Doe',
          ssn: '123-45-6789',
          serviceNumber: 'N12345678',
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
        militaryOccupationalSpecialty: {
          primaryMOS: '68W',
          additionalMOS: ['11B']
        },
        awardsMedalsDecorations: [
          {
            awardName: 'Army Commendation Medal',
            issuanceDate: '2018-06-15'
          }
        ],
        characterOfService: {
          character: 'Honorable'
        },
        separationCodes: {
          separationProgramCode: 'A0',
          reenlistmentCode: 'A1'
        }
      };

      const result = await dd214Scanner.scanDD214(completeDD214);

      // Verify success and validation
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);

      // Verify metric calculations
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalYears).toBe(10);
      expect(result.metrics.serviceTerm).toBe('Career Service');
    });

    it('should standardize field formats deterministically', async () => {
      const dd214Data1 = {
        _metadata: { scannerId: 'dd214-integration-003' },
        personalInfo: {
          fullName: 'Jane Smith',
          ssn: '987-65-4321',
          branch: 'Navy'
        },
        serviceDates: {
          activeEntryDate: '2000-06-01',
          separationDate: '2005-06-01'
        },
        payGradeRank: {
          payGrade: 'E-6',
          rank: 'petty officer first class'
        },
        characterOfService: { character: 'honorable' },
        separationCodes: {
          separationProgramCode: 'A0',
          reenlistmentCode: 'A1'
        }
      };

      const result1 = await dd214Scanner.scanDD214(dd214Data1);
      const result2 = await dd214Scanner.scanDD214(dd214Data1);

      // Verify determinism
      expect(result1.data.payGradeRank.rank).toBe(result2.data.payGradeRank.rank);
      expect(result1.data.personalInfo.branch).toBe(result2.data.personalInfo.branch);
      expect(result1.metrics.totalYears).toBe(result2.metrics.totalYears);
    });
  });

  describe('STR Scanner Integration', () => {
    it('should analyze exposure profile and identify presumptive conditions', async () => {
      const strData = {
        _metadata: {
          scannerId: 'str-integration-001',
          extractionDate: '2024-01-15',
          documentCount: 50
        },
        inServiceDiagnoses: [
          {
            diagnosisCode: 'J60.9',
            diagnosisDescription: 'Pneumoconiosis with Agent Orange exposure',
            encounterDate: '2018-06-20'
          },
          {
            diagnosisCode: '401.9',
            diagnosisDescription: 'Hypertension',
            encounterDate: '2016-01-10'
          }
        ],
        serviceLineExposures: [
          {
            exposureType: 'Agent Orange',
            durationOfExposure: '1968-1971',
            locationOfExposure: 'Vietnam',
            documentationLevel: 'Direct'
          }
        ],
        serviceRelatedInjuries: [
          {
            injuryType: 'Gunshot Wound',
            anatomicalSite: 'Left Leg',
            incidentDate: '1970-04-12',
            currentStatus: 'Chronic'
          }
        ],
        medicalEncounters: [
          { encounterDate: '2015-06-20' },
          { encounterDate: '2016-01-10' },
          { encounterDate: '2018-06-20' }
        ],
        treatmentProviders: [
          {
            providerType: 'Physician',
            facility: 'VA Medical Center',
            firstEncounterDate: '2015-06-20'
          }
        ]
      };

      const result = await strScanner.scanSTR(strData);

      // Verify success
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);

      // Verify exposure analysis
      expect(result.exposureAnalysis).toBeDefined();
      expect(result.exposureAnalysis.exposureCount).toBe(1);
      expect(result.exposureAnalysis.presumptiveExposures.length).toBeGreaterThan(0);

      // Verify presumptive identification
      expect(result.presumptiveAnalysis).toBeDefined();
      expect(result.presumptiveAnalysis.count).toBeGreaterThan(0);

      // Verify chronological timeline
      expect(result.timeline).toBeDefined();
      expect(result.timeline.totalEncounters).toBe(3);
      expect(result.timeline.startDate).toBe('2015-06-20');
      expect(result.timeline.endDate).toBe('2018-06-20');
    });
  });

  describe('Current Treatment Scanner Integration', () => {
    it('should assess medical complexity and functional limitations', async () => {
      const ctrData = {
        _metadata: {
          scannerId: 'ctr-integration-001',
          extractionDate: '2024-01-15',
          reportDate: '2024-01-10'
        },
        activeConditions: [
          {
            conditionName: 'PTSD',
            diagnosisCode: 'F43.10',
            status: 'Active',
            severity: 'Moderate',
            onsetDate: '2015-06-20'
          },
          {
            conditionName: 'Hypertension',
            diagnosisCode: 'I10',
            status: 'Chronic',
            severity: 'Mild',
            onsetDate: '2010-05-15'
          },
          {
            conditionName: 'Type 2 Diabetes',
            diagnosisCode: 'E11',
            status: 'Chronic',
            severity: 'Moderate',
            onsetDate: '2012-03-20'
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
          },
          {
            medicationName: 'Metoprolol',
            dosage: '50mg',
            frequency: 'Twice Daily',
            route: 'Oral',
            indication: 'Hypertension',
            startDate: '2020-06-01'
          },
          {
            medicationName: 'Metformin',
            dosage: '500mg',
            frequency: 'Twice Daily',
            route: 'Oral',
            indication: 'Diabetes',
            startDate: '2019-03-01'
          }
        ],
        functionalImpairments: [
          {
            activityCategory: 'Ambulation',
            severity: 'Mild',
            functionalLimitation: 'Minimal walking tolerance'
          },
          {
            activityCategory: 'ADL',
            severity: 'Moderate',
            functionalLimitation: 'Requires assistance with some activities'
          }
        ],
        symptomsComplaints: [
          {
            symptomName: 'Insomnia',
            duration: '5 years',
            severity: 'Moderate',
            onsetDate: '2019-01-01'
          }
        ],
        treatingProviders: [
          {
            providerName: 'Dr. Johnson',
            specialty: 'Psychiatry',
            facility: 'VA Medical Center',
            lastVisitDate: '2024-01-10'
          }
        ],
        vitalSigns: {
          measurementDate: '2024-01-10',
          bloodPressure: '140/90',
          heartRate: 78,
          temperature: 98.6
        }
      };

      const result = await ctrScanner.scanCurrentTreatment(ctrData);

      // Verify success
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);

      // Verify complexity analysis
      expect(result.complexity).toBeDefined();
      expect(result.complexity.conditionCount).toBe(3);
      expect(result.complexity.medicationCount).toBe(3);
      expect(result.complexity.polypharmacyFlag).toBe(false);  // < 5 meds

      // Verify continuity assessment
      expect(result.continuity).toBeDefined();
      expect(result.continuity.providerCount).toBe(1);

      // Verify functional limitations
      expect(result.limitations).toBeDefined();
      expect(result.limitations.impairmentCount).toBe(2);
      expect(['Independent', 'Mild restriction', 'Moderate restriction', 'Significant restriction', 'Severely dependent']).toContain(result.limitations.functionLevelEstimate);
    });

    it('should detect polypharmacy and treatment gaps', async () => {
      const ctrDataPolypharmacy = {
        _metadata: {
          scannerId: 'ctr-integration-002',
          extractionDate: '2024-01-15',
          reportDate: '2024-01-10'
        },
        activeConditions: [
          {
            conditionName: 'Multiple Conditions',
            diagnosisCode: 'Z00.00',
            status: 'Active',
            severity: 'Moderate'
          }
        ],
        currentMedications: [
          { medicationName: 'Drug1', dosage: '100mg', frequency: 'Daily', route: 'Oral' },
          { medicationName: 'Drug2', dosage: '50mg', frequency: 'Daily', route: 'Oral' },
          { medicationName: 'Drug3', dosage: '25mg', frequency: 'Daily', route: 'Oral' },
          { medicationName: 'Drug4', dosage: '10mg', frequency: 'Daily', route: 'Oral' },
          { medicationName: 'Drug5', dosage: '5mg', frequency: 'Daily', route: 'Oral' },
          { medicationName: 'Drug6', dosage: '2.5mg', frequency: 'Daily', route: 'Oral' }
        ]
      };

      const result = await ctrScanner.scanCurrentTreatment(ctrDataPolypharmacy);

      // Verify polypharmacy detection
      expect(result.complexity.medicationCount).toBe(6);
      expect(result.complexity.polypharmacyFlag).toBe(true);
    });
  });

  describe('Cross-Scanner Consistency', () => {
    it('should produce deterministic results across multiple calls', async () => {
      const testData = {
        _metadata: { scannerId: 'consistency-test-001' },
        personalInfo: {
          fullName: 'Test Veteran',
          ssn: '111-11-1111',
          branch: 'Air Force'
        },
        serviceDates: {
          activeEntryDate: '2005-01-01',
          separationDate: '2015-01-01'
        },
        payGradeRank: {
          payGrade: 'E-7',
          rank: 'Master Sergeant'
        },
        characterOfService: { character: 'Honorable' },
        separationCodes: {
          separationProgramCode: 'A0',
          reenlistmentCode: 'A1'
        }
      };

      // Run same scanner 3 times
      const result1 = await dd214Scanner.scanDD214(testData);
      const result2 = await dd214Scanner.scanDD214(testData);
      const result3 = await dd214Scanner.scanDD214(testData);

      // All results should be identical
      expect(result1.metrics.totalYears).toBe(result2.metrics.totalYears);
      expect(result2.metrics.totalYears).toBe(result3.metrics.totalYears);
      expect(result1.metrics.serviceTerm).toBe(result2.metrics.serviceTerm);
      expect(result2.metrics.serviceTerm).toBe(result3.metrics.serviceTerm);
    });
  });
});
