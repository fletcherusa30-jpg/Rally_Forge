import { describe, expect, it } from 'vitest';
import {
  canonicalEntryKey,
  dedupeManualEntries,
  detectWorseningTrend,
  normalizeConditionName,
  normalizeExtractionResult,
  validateManualEntry,
} from '../tabs/current-treatment/normalization.js';

describe('normalizeConditionName', () => {
  it('maps common PTSD abbreviation to preferred VA terminology', () => {
    expect(normalizeConditionName('ptsd')).toBe('post-traumatic stress disorder');
    expect(normalizeConditionName('PTSD')).toBe('post-traumatic stress disorder');
  });

  it('maps lumbar strain to lower back pain', () => {
    expect(normalizeConditionName('lumbar strain')).toBe('lower back pain');
  });

  it('maps gerd without abbreviation expansion', () => {
    expect(normalizeConditionName('gerd')).toBe('gastroesophageal reflux disease');
  });

  it('returns original value when no alias exists', () => {
    expect(normalizeConditionName('rare esoteric condition xyz')).toBe('rare esoteric condition xyz');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeConditionName('')).toBe('');
    expect(normalizeConditionName(null)).toBe('');
  });
});

describe('validateManualEntry', () => {
  it('returns errors for empty conditionName and symptomSummary', () => {
    const errors = validateManualEntry({ conditionName: '', symptomSummary: '' });
    expect(errors.conditionName).toBeTruthy();
    expect(errors.symptomSummary).toBeTruthy();
  });

  it('passes a complete valid entry with no errors', () => {
    const errors = validateManualEntry({
      conditionName: 'Tinnitus',
      symptomSummary: 'Ringing in ears',
      status: 'active',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns medication errors when name or dosage is blank', () => {
    const errors = validateManualEntry({
      conditionName: 'Tinnitus',
      symptomSummary: 'Ringing in ears',
      medications: [{ medicationName: '', dosage: '', sideEffects: '' }],
    });
    expect(errors['medication_0_name']).toBeTruthy();
    expect(errors['medication_0_dosage']).toBeTruthy();
  });

  it('accepts a complete medication with no errors', () => {
    const errors = validateManualEntry({
      conditionName: 'Tinnitus',
      symptomSummary: 'Ringing in ears',
      medications: [{ medicationName: 'Metoprolol', dosage: '25mg daily', sideEffects: '' }],
    });
    expect(errors['medication_0_name']).toBeUndefined();
    expect(errors['medication_0_dosage']).toBeUndefined();
  });
});

describe('dedupeManualEntries', () => {
  it('keeps only the first entry when conditionName and providerName match', () => {
    const entries = [
      { conditionName: 'Tinnitus', providerName: 'VA Medical Center', symptomSummary: 'First' },
      { conditionName: 'Tinnitus', providerName: 'VA Medical Center', symptomSummary: 'Duplicate' },
    ];
    const result = dedupeManualEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].symptomSummary).toBe('First');
  });

  it('keeps distinct entries when providerName differs', () => {
    const entries = [
      { conditionName: 'Tinnitus', providerName: 'VA Medical Center' },
      { conditionName: 'Tinnitus', providerName: 'Private Clinic' },
    ];
    expect(dedupeManualEntries(entries)).toHaveLength(2);
  });

  it('is case-insensitive for dedup key comparison', () => {
    const entries = [
      { conditionName: 'TINNITUS', providerName: 'VA MEDICAL CENTER' },
      { conditionName: 'tinnitus', providerName: 'va medical center' },
    ];
    expect(dedupeManualEntries(entries)).toHaveLength(1);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeManualEntries([])).toHaveLength(0);
    expect(dedupeManualEntries(null)).toHaveLength(0);
  });
});

describe('detectWorseningTrend', () => {
  it('returns worsening when worseningIndicators contain negative terms', () => {
    const section = {
      extractedFindings: {
        worseningIndicators: ['condition is worsening', 'progressive deterioration'],
        medicationMentions: [],
        functionalLimitations: [],
      },
    };
    const { trend, indicators } = detectWorseningTrend(section);
    expect(trend).toBe('worsening');
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('returns worsening when 4 or more medications are documented', () => {
    const section = {
      extractedFindings: {
        worseningIndicators: [],
        medicationMentions: ['Metoprolol', 'Lisinopril', 'Sertraline', 'Omeprazole'],
        functionalLimitations: ['Limited mobility', 'Cannot lift', 'Chronic fatigue'],
      },
    };
    const { trend } = detectWorseningTrend(section);
    expect(trend).toBe('worsening');
  });

  it('returns unknown when no signals are present', () => {
    const { trend } = detectWorseningTrend({});
    expect(trend).toBe('unknown');
  });

  it('returns improving when only improving terms are present', () => {
    const section = {
      extractedFindings: {
        worseningIndicators: ['symptoms have improved significantly'],
        medicationMentions: [],
        functionalLimitations: [],
      },
    };
    const { trend } = detectWorseningTrend(section);
    expect(trend).toBe('improving');
  });
});

describe('normalizeExtractionResult', () => {
  const mockScannerResponse = {
    extractionMeta: { fileName: 'treatment.pdf', pagesScanned: 3, confidence: 0.88, usedOcr: false },
    data: {
      currentConditions: ['Tinnitus', 'Lower back pain'],
      functionalLimitations: ['Cannot stand longer than 30 minutes'],
      appointments: ['VA audiology appointment 2023-06-15'],
      treatments: ['Physical therapy course'],
      worseningConditions: ['Tinnitus worsening'],
      medications: ['Naproxen 500mg', 'Sertraline 50mg'],
      providerContinuity: ['Dr. Smith, VA audiologist'],
      evidenceSnippets: [],
    },
  };

  it('maps all 7 scanner response categories to extractedFindings', () => {
    const result = normalizeExtractionResult(mockScannerResponse, 'treatment.pdf');
    const { findings } = result;
    expect(findings.currentConditions).toContain('Tinnitus');
    expect(findings.currentConditions).toContain('Lower back pain');
    expect(findings.functionalLimitations).toContain('Cannot stand longer than 30 minutes');
    expect(findings.treatmentEvents.length).toBeGreaterThan(0);
    expect(findings.medicationMentions).toContain('Naproxen 500mg');
    expect(findings.worseningIndicators).toContain('Tinnitus worsening');
    expect(findings.providerSignals).toContain('Dr. Smith, VA audiologist');
  });

  it('includes file metadata in the normalized result', () => {
    const result = normalizeExtractionResult(mockScannerResponse, 'treatment.pdf');
    expect(result.fileName).toBe('treatment.pdf');
    expect(result.pagesScanned).toBe(3);
    expect(result.confidence).toBe(0.88);
  });

  it('returns empty arrays for missing categories', () => {
    const result = normalizeExtractionResult({ data: {}, extractionMeta: {} }, 'empty.pdf');
    const { findings } = result;
    expect(findings.currentConditions).toHaveLength(0);
    expect(findings.functionalLimitations).toHaveLength(0);
    expect(findings.evidenceSnippets).toHaveLength(0);
  });

  it('uses the fileNameFallback when extractionMeta has no fileName', () => {
    const result = normalizeExtractionResult({ data: {} }, 'fallback-name.pdf');
    expect(result.fileName).toBe('fallback-name.pdf');
  });
});
