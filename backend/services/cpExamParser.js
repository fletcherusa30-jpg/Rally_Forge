/**
 * CP Exam Parser - Compensation & Pension Medical Examination
 * Extracts examination data from VA Compensation & Pension (C&P) examination reports
 */

function parseCompensationPensionExam(payload = {}) {
  return {
    type: 'CP_EXAM',
    sourceType: 'compensation-pension-exam',
    examType: normalizeExamType(payload.examType),
    parsed: {
      examinationDate: payload.examinationDate || null,
      examiner: {
        name: String(payload.examiner?.name || '').trim() || null,
        specialty: String(payload.examiner?.specialty || '').trim() || null,
        credentials: String(payload.examiner?.credentials || '').trim() || null,
      },
      veteran: {
        serviceNumber: String(payload.veteran?.serviceNumber || '').trim() || null,
        rank: String(payload.veteran?.rank || '').trim() || null,
        branchOfService: String(payload.veteran?.branchOfService || '').trim() || null,
      },
      claimNumber: String(payload.claimNumber || '').trim() || null,
      findings: extractFindings(payload.findings || []),
      measurements: extractMeasurements(payload.measurements || {}),
      functionalImpairments: extractFunctionalImpairments(payload.functionalImpairments || []),
      recommendedRating: payload.recommendedRating || null,
      comments: String(payload.comments || '').trim().substring(0, 10000) || null,
    },
  };
}

function normalizeExamType(examType) {
  const type = String(examType || '').trim().toUpperCase();
  const types = [
    'INITIAL',
    'FOLLOWUP',
    'REEXAM',
    'PERMANENT_AND_TOTAL',
    'EMPLOYABILITY',
    'SPECIAL_ISSUE',
    'APPEALED_RATING',
  ];
  return types.includes(type) ? type : 'GENERAL';
}

function extractFindings(findings) {
  if (!Array.isArray(findings)) return [];
  return findings.map((f) => ({
    condition: String(f.condition || f || '').trim(),
    finding: String(f.finding || '').trim(),
    severity: normalizeSeverity(f.severity),
    icdCode: String(f.icdCode || '').trim() || null,
    serviceConnected: Boolean(f.serviceConnected),
  }));
}

function normalizeSeverity(severity) {
  const sev = String(severity || '').trim().toUpperCase();
  const severities = ['MILD', 'MODERATE', 'MODERATELY_SEVERE', 'SEVERE'];
  return severities.includes(sev) ? sev : 'UNKNOWN';
}

function extractMeasurements(measurements) {
  if (typeof measurements !== 'object' || measurements === null) return {};
  return {
    height: measurements.height || null,
    weight: measurements.weight || null,
    bmi: calculateBMI(measurements.height, measurements.weight),
    bloodPressure: measurements.bloodPressure || null,
    pulseRate: measurements.pulseRate || null,
    temperature: measurements.temperature || null,
    respiratoryRate: measurements.respiratoryRate || null,
  };
}

function calculateBMI(height, weight) {
  if (!height || !weight) return null;
  const h = Number(height);
  const w = Number(weight);
  if (h <= 0 || w <= 0) return null;
  const bmi = w / (h * h) * 703;
  return Math.round(bmi * 10) / 10;
}

function extractFunctionalImpairments(impairments) {
  if (!Array.isArray(impairments)) return [];
  return impairments.map((imp) => ({
    category: String(imp.category || '').trim(),
    limitation: String(imp.limitation || '').trim(),
    ratingCode: String(imp.ratingCode || '').trim() || null,
    percentRating: Number(imp.percentRating) || 0,
  }));
}

function validateCPExam(examData) {
  const result = {
    isValid: false,
    errors: [],
    warnings: [],
  };

  if (!examData.examinationDate) {
    result.errors.push('examination date is required');
  }

  if (!examData.examiner?.name) {
    result.errors.push('examiner name is required');
  }

  if (!examData.veteran?.branchOfService) {
    result.warnings.push('veteran branch of service recommended');
  }

  if (!Array.isArray(examData.findings) || examData.findings.length === 0) {
    result.warnings.push('no findings extracted');
  }

  result.isValid = result.errors.length === 0;
  return result;
}

export {
  calculateBMI,
  extractFindings,
  extractFunctionalImpairments,
  extractMeasurements,
  normalizeExamType,
  normalizeSeverity,
  parseCompensationPensionExam,
  validateCPExam,
};
