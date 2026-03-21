import test from 'node:test';
import assert from 'node:assert/strict';

import { DD214_SEMANTIC_ANCHOR_MAP, buildDD214SemanticExtractionMetadata } from '../../backend/va_scanner/backend/shared/scanner/dd214SemanticAnchors.js';
import { parseDD214 } from '../../backend/va_scanner/backend/shared/scanner/dd214Scanner.js';
import { detectDD214Variant } from '../../backend/va_scanner/backend/shared/scanner/dd214VariantModel.js';
import { detectDD214Blocks } from '../../backend/va_scanner/backend/shared/scanner/dd214BlockDetectionModel.js';
import { resolveDD214Template } from '../../backend/va_scanner/backend/shared/scanner/dd214TemplateLibrary.js';

const sampleText = `
DD FORM 214 MEMBER-4
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME (Last, First, Middle)\nDOE, JANE Q
2. DEPARTMENT, COMPONENT AND BRANCH\nARMY / RA
11. PRIMARY SPECIALTY\n13B3P CANNON CREWMEMBER
12a. DATE ENTERED AD THIS PERIOD\n2009-04-28
12b. SEPARATION DATE THIS PERIOD\n2017-11-26
12c. NET ACTIVE SERVICE THIS PERIOD\n0008 06 27
12d. TOTAL PRIOR ACTIVE SERVICE\n0004 09 00
12e. TOTAL PRIOR INACTIVE SERVICE\n0000 11 00
13. DECORATIONS, MEDALS, BADGES\nAFGHANISTAN CAMPAIGN MEDAL//ARMY COMMENDATION MEDAL (5TH AWARD)//PARACHUTIST BADGE
18. REMARKS\nSERVICE IN AFGHANISTAN FROM 20110301-20120201//MEMBER SERVED IN A DESIGNATED IMMINENT DANGER PAY AREA//OEF
24. CHARACTER OF SERVICE\nHONORABLE
25. SEPARATION AUTHORITY\nAR 635-40, CHAP 4 SEC 4
26. SEPARATION CODE\nSEJ
27. REENTRY CODE\n1
28. NARRATIVE REASON FOR SEPARATION\nDISABILITY, PERMANENT
`;

test('semantic anchor map covers required DD-214 extraction categories', () => {
  const requiredFields = [
    'veteranName',
    'branchOfService',
    'rankGradeAtSeparation',
    'payGrade',
    'primarySpecialty',
    'serviceComponent',
    'serviceType',
    'entryDate',
    'separationDate',
    'netActiveService',
    'totalService',
    'serviceEras',
    'characterOfService',
    'dischargeType',
    'separationAuthority',
    'separationCode',
    'reentryCode',
    'narrativeReasonForSeparation',
    'combatVeteran',
    'deploymentLocations',
    'campaigns',
    'operationNames',
    'hazardousDutyIndicators',
    'awards',
    'occupationalCategory',
    'combatArmsIndicator',
    'specialDutyIndicator',
  ];

  for (const field of requiredFields) {
    assert.ok(DD214_SEMANTIC_ANCHOR_MAP[field], `Missing semantic anchor definition for ${field}`);
    assert.ok(Array.isArray(DD214_SEMANTIC_ANCHOR_MAP[field].supportedVariants));
    assert.ok(DD214_SEMANTIC_ANCHOR_MAP[field].supportedVariants.length > 0);
  }
});

test('semantic extraction metadata returns normalized mappings and variant notes', () => {
  const parsed = parseDD214(sampleText);
  const variantDetection = detectDD214Variant(sampleText);
  const template = resolveDD214Template(variantDetection, sampleText);
  const blockDetection = detectDD214Blocks(sampleText, variantDetection);
  const metadata = buildDD214SemanticExtractionMetadata({
    parsedResult: parsed,
    sourceText: sampleText,
    variantDetection,
    template,
    blockDetection,
  });

  assert.equal(metadata.strategy, 'semantic-first-positional-fallback');
  assert.ok(metadata.variantNotes.some((note) => /Variant detected/i.test(note)));
  assert.ok(Array.isArray(metadata.normalizedMappings.serviceEras));
  assert.ok(metadata.normalizedMappings.serviceEras.includes('Gulf War Era'));
  assert.ok(metadata.normalizedMappings.serviceEras.includes('OEF/OIF/OND'));
  assert.equal(metadata.normalizedMappings.serviceComponent, 'Active Duty');
  assert.equal(metadata.normalizedMappings.serviceType, 'Active Duty');
  assert.ok(metadata.fieldConfidence.veteranName > 0);
  assert.ok(metadata.fieldCoverage.deploymentLocations.resolved);
});

test('parseDD214 output includes semantic anchors, normalized mappings, and analysis variant notes', () => {
  const parsed = parseDD214(sampleText);

  assert.ok(parsed.extractionMeta.semanticAnchors);
  assert.ok(parsed.extractionMeta.semanticAnchors.fieldConfidence);
  assert.ok(parsed.extractionMeta.normalizedMappings);
  assert.ok(parsed.extractionMeta.variantNotes.length > 0);
  assert.ok(parsed.dd214Analysis.identification.variantNotes.length > 0);
  assert.ok(parsed.dd214Analysis.confidenceScores.semanticFields);
});

test('semantic award normalization removes OCR noise and keeps canonical medal names', () => {
  const noisySample = `
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)\nDOE, JOHN R
2. DEPARTMENT, COMPONENT AND BRANCH\nARMY / RA
13. DECORATIONS, MEDALS, BADGES\nGWOTSM//ARCOM (5TH AWARD)//RIBBONS AWARDED OR AUTHORIZED
24. CHARACTER OF SERVICE\nHONORABLE
`;

  const parsed = parseDD214(noisySample);
  const metadata = buildDD214SemanticExtractionMetadata({
    parsedResult: parsed,
    sourceText: noisySample,
  });

  assert.ok(metadata.normalizedMappings.awards.includes('GLOBAL WAR ON TERRORISM SERVICE MEDAL'));
  assert.ok(metadata.normalizedMappings.awards.includes('ARMY COMMENDATION MEDAL'));
  assert.equal(metadata.normalizedMappings.awards.some((award) => /RIBBONS AWARDED OR AUTHORIZED/i.test(award)), false);
  assert.ok(parsed.dd214Analysis.awards.some((award) => award.name === 'GLOBAL WAR ON TERRORISM SERVICE MEDAL'));
});
