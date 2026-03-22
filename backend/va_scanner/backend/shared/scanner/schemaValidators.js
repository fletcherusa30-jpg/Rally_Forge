/**
 * Deterministic schema validators for scanner outputs.
 */

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDuration(value) {
  if (value === null) return true;
  if (!isObject(value)) return false;
  const keys = ['years', 'months', 'days'];
  return keys.every((k) => Number.isInteger(value[k]) && value[k] >= 0);
}

function isIsoDate(value) {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime());
}

function hasExactKeys(obj, expectedKeys) {
  if (!isObject(obj)) return false;
  const actual = Object.keys(obj);
  if (actual.length !== expectedKeys.length) return false;
  return expectedKeys.every((k, i) => actual[i] === k);
}

function hasAnyExactKeys(obj, keySets) {
  return keySets.some((expectedKeys) => hasExactKeys(obj, expectedKeys));
}

function isValidMos(value) {
  if (value === null) return true;
  const v = String(value || '').trim().toUpperCase();
  if (!v) return false;
  if (/^\d{2}[A-Z][A-Z0-9]{0,3}$/.test(v)) return true; // MOS-like
  if (/^\d[A-Z][A-Z0-9]{1,5}$/.test(v)) return true; // AFSC-like including compact USSF codes
  if (/^[A-Z]{2,4}\d?$/.test(v)) return true; // rating-like
  return false;
}

function isValidAwardList(value) {
  if (value === null) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    const s = String(item || '').trim();
    return s.length >= 3 && s.length <= 150;
  });
}

function assert(condition, field, reason, errors) {
  if (!condition) errors.push({ field, reason });
}

export function validateDD214Schema(dd214) {
  const errors = [];

  const topKeys = [
    'documentType',
    'schemaVersion',
    'serviceIdentity',
    'servicePeriods',
    'characterAndSeparation',
    'gradeSpecialty',
    'decorationsAndService',
    'specialProgramsRemarks',
    'postServiceContact',
    'extractionMeta',
  ];
  const topKeysV3 = [
    'documentType',
    'schemaVersion',
    'serviceIdentity',
    'servicePeriods',
    'characterAndSeparation',
    'gradeSpecialty',
    'decorationsAndService',
    'specialProgramsRemarks',
    'postServiceContact',
    'intelligentExtraction',
    'extractionMeta',
  ];

  assert(hasAnyExactKeys(dd214, [topKeys, topKeysV3]), 'dd214', 'Top-level keys/order mismatch', errors);

  const identityKeys = ['veteranName', 'ssnOrServiceNumber', 'branchOfService', 'component'];
  const periodKeys = ['entryDate', 'separationDate', 'netActiveServiceThisPeriod', 'totalPriorActiveService', 'totalPriorInactiveService'];
  const sepKeys = ['characterOfService', 'narrativeReasonForSeparation', 'separationAuthority', 'separationCode', 'reentryCode'];
  const gradeKeys = ['gradeRateRank', 'payGrade', 'primaryMOSOrAFSCOrRating', 'additionalMOSOrSpecialties'];
  const decorKeys = ['decorationsAndAwards', 'foreignServiceTotal', 'foreignServiceLocationsIfListed', 'combatIndicatorsFromAwards'];
  const remarkKeys = ['remarksBlock', 'deploymentOrCampaignReferences', 'separationIncentives', 'disabilitySeveranceOrDisabilityIndicator', 'earlySeparationPrograms'];
  const contactKeys = ['mailingAddressAtSeparation', 'nearestRelativeOrEmergencyContact'];

  assert(hasExactKeys(dd214?.serviceIdentity, identityKeys), 'serviceIdentity', 'Keys/order mismatch', errors);
  assert(hasExactKeys(dd214?.servicePeriods, periodKeys), 'servicePeriods', 'Keys/order mismatch', errors);
  assert(hasExactKeys(dd214?.characterAndSeparation, sepKeys), 'characterAndSeparation', 'Keys/order mismatch', errors);
  assert(hasExactKeys(dd214?.gradeSpecialty, gradeKeys), 'gradeSpecialty', 'Keys/order mismatch', errors);
  assert(hasExactKeys(dd214?.decorationsAndService, decorKeys), 'decorationsAndService', 'Keys/order mismatch', errors);
  assert(hasExactKeys(dd214?.specialProgramsRemarks, remarkKeys), 'specialProgramsRemarks', 'Keys/order mismatch', errors);
  assert(hasExactKeys(dd214?.postServiceContact, contactKeys), 'postServiceContact', 'Keys/order mismatch', errors);

  assert(isIsoDate(dd214?.servicePeriods?.entryDate), 'servicePeriods.entryDate', 'Invalid ISO date', errors);
  assert(isIsoDate(dd214?.servicePeriods?.separationDate), 'servicePeriods.separationDate', 'Invalid ISO date', errors);
  assert(isDuration(dd214?.servicePeriods?.netActiveServiceThisPeriod), 'servicePeriods.netActiveServiceThisPeriod', 'Invalid duration', errors);
  assert(isDuration(dd214?.servicePeriods?.totalPriorActiveService), 'servicePeriods.totalPriorActiveService', 'Invalid duration', errors);
  assert(isDuration(dd214?.servicePeriods?.totalPriorInactiveService), 'servicePeriods.totalPriorInactiveService', 'Invalid duration', errors);
  assert(isDuration(dd214?.decorationsAndService?.foreignServiceTotal), 'decorationsAndService.foreignServiceTotal', 'Invalid duration', errors);

  const component = dd214?.serviceIdentity?.component;
  assert(component === null || ['Active', 'Reserve', 'Guard'].includes(component), 'serviceIdentity.component', 'Invalid allowed value', errors);

  const char = String(dd214?.characterAndSeparation?.characterOfService || '').toUpperCase();
  const allowedCharacter = [
    'HONORABLE',
    'GENERAL',
    'GENERAL (UNDER HONORABLE CONDITIONS)',
    'UNDER HONORABLE CONDITIONS',
    'OTHER THAN HONORABLE',
    'BAD CONDUCT',
    'DISHONORABLE',
  ];
  assert(!char || allowedCharacter.includes(char), 'characterAndSeparation.characterOfService', 'Invalid allowed value', errors);

  assert(isValidMos(dd214?.gradeSpecialty?.primaryMOSOrAFSCOrRating), 'gradeSpecialty.primaryMOSOrAFSCOrRating', 'Invalid MOS/AFSC/Rating value', errors);
  if (Array.isArray(dd214?.gradeSpecialty?.additionalMOSOrSpecialties)) {
    dd214.gradeSpecialty.additionalMOSOrSpecialties.forEach((mos, idx) => {
      assert(isValidMos(mos), `gradeSpecialty.additionalMOSOrSpecialties[${idx}]`, 'Invalid MOS/AFSC/Rating value', errors);
    });
  }

  assert(isValidAwardList(dd214?.decorationsAndService?.decorationsAndAwards), 'decorationsAndService.decorationsAndAwards', 'Invalid awards list', errors);
  assert(isValidAwardList(dd214?.decorationsAndService?.combatIndicatorsFromAwards), 'decorationsAndService.combatIndicatorsFromAwards', 'Invalid combat indicators list', errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateSTRSchema(strData) {
  const errors = [];
  const topKeys = [
    'medicalEvents',
    'injuries',
    'chronicConditions',
    'mentalHealthFlags',
    'exposureEvents',
    'dutyLimitations',
    'surgeries',
    'medications',
  ];
  const topKeysV3 = [
    'documentType',
    'schemaVersion',
    'scannerVersion',
    'medicalEvents',
    'injuries',
    'chronicConditions',
    'mentalHealthFlags',
    'exposureEvents',
    'dutyLimitations',
    'surgeries',
    'medications',
    'extractionMeta',
  ];

  assert(hasAnyExactKeys(strData, [topKeys, topKeysV3]), 'strData', 'Top-level keys/order mismatch', errors);

  topKeys.forEach((k) => {
    assert(Array.isArray(strData?.[k]), k, 'Must be an array', errors);
  });

  if ('schemaVersion' in (strData || {})) {
    assert(strData?.schemaVersion === '3.0.0', 'schemaVersion', 'Must be 3.0.0 for enriched STR output', errors);
  }

  if ('extractionMeta' in (strData || {})) {
    const metaResult = validateExtractionMetaSchema(strData?.extractionMeta);
    metaResult.errors.forEach((error) => errors.push(error));
  }

  return { valid: errors.length === 0, errors };
}

export function validateCrossVerificationSchema(crossData) {
  const errors = [];
  const baseKeys = ['matches', 'mismatches', 'missingEvidence', 'confidenceScores'];
  const withInferred = ['matches', 'mismatches', 'missingEvidence', 'inferredConnections', 'confidenceScores'];
  const enriched = ['documentType', 'schemaVersion', 'matches', 'mismatches', 'missingEvidence', 'confidenceScores', 'extractionMeta'];
  const enrichedWithInferred = ['documentType', 'schemaVersion', 'matches', 'mismatches', 'missingEvidence', 'inferredConnections', 'confidenceScores', 'extractionMeta'];
  const hasValidShape = hasAnyExactKeys(crossData, [baseKeys, withInferred, enriched, enrichedWithInferred]);
  assert(hasValidShape, 'crossData', 'Top-level keys/order mismatch', errors);

  const keysToCheck = ['matches', 'mismatches', 'missingEvidence', 'confidenceScores'];
  if ('inferredConnections' in (crossData || {})) {
    keysToCheck.push('inferredConnections');
  }
  keysToCheck.forEach((k) => {
    assert(Array.isArray(crossData?.[k]), k, 'Must be an array', errors);
  });

  if ('extractionMeta' in (crossData || {})) {
    const metaResult = validateExtractionMetaSchema(crossData?.extractionMeta);
    metaResult.errors.forEach((error) => errors.push(error));
  }

  return { valid: errors.length === 0, errors };
}

export function validateExtractionMetaSchema(meta) {
  const errors = [];
  assert(isObject(meta), 'extractionMeta', 'Must be an object', errors);
  assert(typeof meta?.confidence === 'number' && meta.confidence >= 0 && meta.confidence <= 1, 'extractionMeta.confidence', 'Must be number between 0 and 1', errors);
  assert(Number.isInteger(meta?.fieldsPopulated) && meta.fieldsPopulated >= 0, 'extractionMeta.fieldsPopulated', 'Must be non-negative integer', errors);
  assert(Number.isInteger(meta?.fieldsTotal) && meta.fieldsTotal >= 0, 'extractionMeta.fieldsTotal', 'Must be non-negative integer', errors);
  assert(typeof meta?.extractedAt === 'string', 'extractionMeta.extractedAt', 'Must be string timestamp', errors);
  if ('schemaVersion' in (meta || {})) {
    assert(typeof meta?.schemaVersion === 'string' && meta.schemaVersion.length > 0, 'extractionMeta.schemaVersion', 'Must be non-empty string', errors);
  }
  if ('scannerVersion' in (meta || {})) {
    assert(typeof meta?.scannerVersion === 'string' && meta.scannerVersion.length > 0, 'extractionMeta.scannerVersion', 'Must be non-empty string', errors);
  }
  if ('scannerType' in (meta || {})) {
    assert(typeof meta?.scannerType === 'string' && meta.scannerType.length > 0, 'extractionMeta.scannerType', 'Must be non-empty string', errors);
  }
  if ('diagnostics' in (meta || {})) {
    assert(isObject(meta?.diagnostics), 'extractionMeta.diagnostics', 'Must be an object', errors);
    if (isObject(meta?.diagnostics)) {
      const diagnostics = meta.diagnostics;
      if ('stage' in diagnostics) {
        assert(typeof diagnostics.stage === 'string' && diagnostics.stage.length > 0, 'extractionMeta.diagnostics.stage', 'Must be non-empty string', errors);
      }
      if ('parserProfile' in diagnostics && diagnostics.parserProfile !== null) {
        assert(typeof diagnostics.parserProfile === 'string' && diagnostics.parserProfile.length > 0, 'extractionMeta.diagnostics.parserProfile', 'Must be string or null', errors);
      }
      if ('classifier' in diagnostics && diagnostics.classifier !== null) {
        assert(typeof diagnostics.classifier === 'string' && diagnostics.classifier.length > 0, 'extractionMeta.diagnostics.classifier', 'Must be string or null', errors);
      }
      if ('usedOcr' in diagnostics) {
        assert(typeof diagnostics.usedOcr === 'boolean', 'extractionMeta.diagnostics.usedOcr', 'Must be boolean', errors);
      }
      if ('ocrProfile' in diagnostics && diagnostics.ocrProfile !== null) {
        assert(typeof diagnostics.ocrProfile === 'string' && diagnostics.ocrProfile.length > 0, 'extractionMeta.diagnostics.ocrProfile', 'Must be string or null', errors);
      }
      if ('ocrConfidence' in diagnostics && diagnostics.ocrConfidence !== null) {
        assert(typeof diagnostics.ocrConfidence === 'number' && diagnostics.ocrConfidence >= 0, 'extractionMeta.diagnostics.ocrConfidence', 'Must be non-negative number or null', errors);
      }
      if ('ocrScannerVersion' in diagnostics && diagnostics.ocrScannerVersion !== null) {
        assert(typeof diagnostics.ocrScannerVersion === 'string' && diagnostics.ocrScannerVersion.length > 0, 'extractionMeta.diagnostics.ocrScannerVersion', 'Must be string or null', errors);
      }
      if ('ocrFallbackError' in diagnostics && diagnostics.ocrFallbackError !== null) {
        assert(typeof diagnostics.ocrFallbackError === 'string', 'extractionMeta.diagnostics.ocrFallbackError', 'Must be string or null', errors);
      }
      if ('warnings' in diagnostics) {
        assert(Array.isArray(diagnostics.warnings) && diagnostics.warnings.every((item) => typeof item === 'string'), 'extractionMeta.diagnostics.warnings', 'Must be array of strings', errors);
      }
      if ('errors' in diagnostics) {
        assert(Array.isArray(diagnostics.errors) && diagnostics.errors.every((item) => typeof item === 'string'), 'extractionMeta.diagnostics.errors', 'Must be array of strings', errors);
      }
      if ('signals' in diagnostics) {
        assert(Array.isArray(diagnostics.signals) && diagnostics.signals.every((item) => typeof item === 'string'), 'extractionMeta.diagnostics.signals', 'Must be array of strings', errors);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateCurrentTreatmentSchema(ctData) {
  const errors = [];
  const requiredArrayKeys = [
    'currentConditions',
    'worseningConditions',
    'functionalLimitations',
    'medications',
    'treatments',
    'providers',
    'testsAndResults',
    'appointments',
  ];

  requiredArrayKeys.forEach((k) => {
    assert(Array.isArray(ctData?.[k]), k, 'Must be an array', errors);
  });

  assert(typeof ctData?.documentType === 'string' && ctData.documentType.length > 0, 'documentType', 'Must be non-empty string', errors);
  assert(typeof ctData?.schemaVersion === 'string' && ctData.schemaVersion.length > 0, 'schemaVersion', 'Must be non-empty string', errors);

  if ('currentTreatmentAnalysis' in (ctData || {})) {
    assert(ctData?.currentTreatmentAnalysis !== null && typeof ctData?.currentTreatmentAnalysis === 'object', 'currentTreatmentAnalysis', 'Must be an object', errors);
  }

  if ('extractionMeta' in (ctData || {})) {
    const metaResult = validateExtractionMetaSchema(ctData?.extractionMeta);
    metaResult.errors.forEach((error) => errors.push(error));
  }

  return { valid: errors.length === 0, errors };
}

export function validateDD214SchemaV3(dd214) {
  const errors = [];
  const topKeys = [
    'documentType',
    'schemaVersion',
    'serviceIdentity',
    'servicePeriods',
    'characterAndSeparation',
    'gradeSpecialty',
    'decorationsAndService',
    'specialProgramsRemarks',
    'postServiceContact',
    'intelligentExtraction',
    'extractionMeta',
  ];

  assert(hasExactKeys(dd214, topKeys), 'dd214', 'V3 keys mismatch', errors);
  assert(dd214?.schemaVersion === '3.0.0', 'schemaVersion', 'Must be 3.0.0', errors);
  assert(isObject(dd214?.intelligentExtraction), 'intelligentExtraction', 'Must be an object', errors);

  const metaResult = validateExtractionMetaSchema(dd214?.extractionMeta);
  metaResult.errors.forEach((error) => errors.push(error));

  return { valid: errors.length === 0, errors };
}
