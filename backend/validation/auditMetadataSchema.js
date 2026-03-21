import { z } from 'zod';

const nullableString = z.string().nullable();

const driftSchema = z.object({
  snapshot: z.object({
    available: z.boolean(),
    previousAvailable: z.boolean(),
    changed: z.boolean(),
    schemaVersionChanged: z.boolean(),
    changedStates: z.array(z.string()),
  }),
  audit: z.object({
    available: z.boolean(),
    previousAvailable: z.boolean(),
    schemaVersionChanged: z.boolean(),
    coverageMissingStatesChanged: z.boolean(),
    watchdogChecksChanged: z.boolean(),
  }),
  canonicalSchema: z.object({
    benefitsSchemaVersion: z.string(),
    hasCoverageObject: z.boolean(),
    hasDiscoveryMap: z.boolean(),
    hasExtractedSchemas: z.boolean(),
    mismatchSignals: z.array(z.string()),
  }),
});

const modernizationStatusEntrySchema = z.object({
  status: z.enum(['unknown', 'partial', 'modernized']),
  evidence: z.array(z.string()),
  missing: z.array(z.string()).optional(),
});

const confidenceSchema = z.object({
  score: z.number().min(0).max(1),
  method: z.string(),
});

export const auditMetadataSchema = z.object({
  endpointVersion: z.string(),
  schemaVersion: z.string(),
  snapshot: z.object({
    canonicalSchemaVersion: z.string(),
    benefitsDatasetVersion: z.string(),
    scannerEngineVersion: z.string(),
    analyzerEngineVersion: z.string(),
    summaryEngineVersion: z.string(),
    uiSchemaVersion: z.string(),
    backendSchemaVersion: z.string(),
    watchdogGeneratedAt: nullableString,
  }),
  audit: z.object({
    missingStates: z.array(z.string()),
    missingFields: z.array(z.string()),
    missingBenefits: z.array(z.string()),
    outdatedBenefits: z.array(z.string()),
    schemaMismatches: z.array(z.string()),
    normalizationGaps: z.array(z.string()),
    validationFailures: z.array(z.string()),
    counts: z.object({
      inputStateRecords: z.number(),
      outputStateRecords: z.number(),
      outputFederalPrograms: z.number(),
      missingStates: z.number(),
      extractedSchemas: z.number(),
      discoveryBuckets: z.number(),
      coverageExpectedStates: z.number(),
      coveragePresentStates: z.number(),
    }),
  }),
  drift: driftSchema,
  modernization: z.object({
    backend: modernizationStatusEntrySchema,
    ui: modernizationStatusEntrySchema,
    scanner: modernizationStatusEntrySchema,
    analyzer: modernizationStatusEntrySchema,
    caseSummary: modernizationStatusEntrySchema,
    benefits: modernizationStatusEntrySchema,
  }),
  freshness: z.object({
    policyVersion: z.string(),
    staleSources: z.array(z.string()),
    sources: z.array(z.object({
      source: z.string(),
      path: z.string(),
      found: z.boolean(),
      maxAgeMinutes: z.number().nullable(),
      ageMinutes: z.number().nullable(),
      stale: z.boolean(),
      lastModifiedAt: nullableString,
    })),
  }),
  health: z.object({
    pass: z.boolean(),
    status: z.enum(['pass', 'warn', 'fail']),
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
    unresolvedIssues: z.array(z.string()),
    confidence: confidenceSchema,
  }),
  provenance: z.object({
    sources: z.array(z.object({ path: z.string(), found: z.boolean() })),
    generatedBy: z.string(),
  }),
  confidence: confidenceSchema,
});

export function validateAuditMetadata(payload) {
  return auditMetadataSchema.parse(payload);
}
