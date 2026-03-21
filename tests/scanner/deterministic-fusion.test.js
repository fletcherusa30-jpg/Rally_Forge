import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStrAnalysis } from '../../backend/va_scanner/backend/shared/scanner/strAnalysis/index.js';
import { buildCurrentTreatmentAnalysis } from '../../backend/va_scanner/backend/shared/scanner/currentTreatmentAnalysis/index.js';
import { buildRatingDecisionAnalysis } from '../../backend/va_scanner/backend/shared/scanner/ratingDecisionAnalysis.js';
import { fuseScannerAnalyses } from '../../backend/va_scanner/backend/shared/scanner/crossScannerFusionEngine.js';

const strText = `
2014-05-11 Diagnosis: lumbar strain
2014-05-11 reports chronic back pain with limited duty profile
2015-08-22 MRI shows lumbar spine findings
`;

const currentTreatmentText = `
2023-02-10 diagnosis: lumbar strain
2023-02-10 worsening low back pain
2023-02-10 medication: gabapentin 300mg
2023-02-10 follow-up appointment in 30 days
`;

const ratingDecisionText = `
DECISION
Service connection for lumbar strain is granted with an evaluation of 20 percent effective 02/10/2023.
Service connection for migraine headaches is denied because no nexus was established.
REASONS FOR DECISION
Evidence shows ongoing treatment for lumbar strain.
`;

test('deterministic subsystems produce strict analysis contracts and fusion output', async () => {
  const strAnalysis = buildStrAnalysis(strText);
  const currentTreatmentAnalysis = buildCurrentTreatmentAnalysis(currentTreatmentText);

  const fakeScan = {
    serviceConnected: {
      conditions: [
        {
          condition: 'lumbar strain',
          diagnosticCode: '5237',
          rating: '20',
          effectiveDate: '2023-02-10',
        },
      ],
    },
    denied: {
      conditions: [
        {
          condition: 'migraine headaches',
          reasons: ['No nexus established'],
        },
      ],
    },
  };

  const ratingDecisionAnalysis = await buildRatingDecisionAnalysis(ratingDecisionText, fakeScan);
  const fusion = await fuseScannerAnalyses({
    strAnalysis,
    currentTreatmentAnalysis,
    ratingDecisionAnalysis,
  });

  assert.equal(strAnalysis.extractionMode, 'deterministic-explicit-only');
  assert.ok(strAnalysis.confidenceSummary.diagnoses);

  assert.equal(currentTreatmentAnalysis.extractionMode, 'deterministic-explicit-only');
  assert.ok(currentTreatmentAnalysis.confidenceSummary.currentConditions);

  assert.equal(ratingDecisionAnalysis.extractionMode, 'deterministic-explicit-only');
  assert.ok(Array.isArray(ratingDecisionAnalysis.grantedConditions));
  assert.ok(Array.isArray(ratingDecisionAnalysis.deniedConditions));
  assert.ok(Array.isArray(ratingDecisionAnalysis.diagnosticCodeValidation.validations));
  assert.ok(Array.isArray(ratingDecisionAnalysis.cfrCriteriaLookup.lookups));

  const lumbarFusion = fusion.correlatedConditions.find((item) => item.conditionKey.includes('lumbar strain'));
  assert.ok(lumbarFusion, 'expected lumbar strain to correlate across scanners');
  assert.equal(fusion.schemaVersion, '1.0.0');
});
