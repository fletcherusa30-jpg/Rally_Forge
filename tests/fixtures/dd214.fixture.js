/**
 * DD214 test fixture — Phase 6.
 * Minimal valid DD214 scanner output used in graph and unit tests.
 */

export const DD214_FIXTURE = {
  documentId:      'dd214-fixture-001',
  schemaVersion:   '2.0.0',
  serviceIdentity: {
    veteranName:     'SMITH JOHN A',
    branchOfService: 'Army',
    component:       'Active Duty',
    ssnLastFour:     '0001',
  },
  servicePeriods: {
    entryDate:       '2010-06-01',
    separationDate:  '2014-05-31',
  },
  gradeSpecialty: {
    rank:                         'SGT',
    primaryMOSOrAFSCOrRating:    '11B',
    additionalMOSOrSpecialties:  [],
  },
  characterAndSeparation: {
    characterOfService: 'Honorable',
    separationCode:     'JFV',
    reEnlistmentCode:   'RE-1',
  },
  decorationsAndService: {
    decorationsMedalsAwards:             ['Army Achievement Medal'],
    foreignServiceLocationsIfListed:     ['Afghanistan'],
    combatIndicatorsFromAwards:          ['Combat Infantryman Badge'],
  },
  specialProgramsRemarks: {
    deploymentOrCampaignReferences:      ['Operation Enduring Freedom'],
  },
  extractionMeta: {
    scannerVersion: '2.0.0-authoritative',
    pageCount:       4,
    usedOcr:         false,
    extractedAt:    '2024-01-15T00:00:00.000Z',
  },
};

export const VETERAN_ID_FIXTURE = 'veteran-fixture-001';
