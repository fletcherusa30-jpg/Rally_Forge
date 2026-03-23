/**
 * Credentialing Engine - Military Qualifications and Certifications
 * Manages credentialing data, military qualifications, badges, and civilian certifications
 */

const militaryCertifications = new Map();

function registerCredential(veteranId, credential = {}) {
  if (!veteranId) {
    return { isValid: false, errors: ['veteran ID is required'] };
  }

  const normalized = normalizeCredential(credential);

  if (normalized.errors.length > 0) {
    return { isValid: false, errors: normalized.errors };
  }

  if (!militaryCertifications.has(veteranId)) {
    militaryCertifications.set(veteranId, { veteranId, credentials: [], indexedByType: new Map() });
  }

  const record = militaryCertifications.get(veteranId);
  const existingIndex = record.credentials.findIndex(
    (c) => c.credentialType === normalized.credentialType && c.credentialCode === normalized.credentialCode
  );

  if (existingIndex >= 0) {
    record.credentials[existingIndex] = normalized;
  } else {
    record.credentials.push(normalized);
  }

  if (!record.indexedByType.has(normalized.credentialType)) {
    record.indexedByType.set(normalized.credentialType, []);
  }

  const typeArray = record.indexedByType.get(normalized.credentialType);
  const typeIndex = typeArray.findIndex((c) => c.credentialCode === normalized.credentialCode);

  if (typeIndex >= 0) {
    typeArray[typeIndex] = normalized;
  } else {
    typeArray.push(normalized);
  }

  return {
    isValid: true,
    credential: normalized,
  };
}

function normalizeCredential(credential = {}) {
  const errors = [];

  const type = String(credential.credentialType || credential.type || '').trim().toUpperCase();
  const code = String(credential.credentialCode || credential.code || '').trim().toUpperCase();

  const validTypes = [
    'BADGE',
    'RIBBON',
    'MEDAL',
    'QUALIFICATION',
    'RATING',
    'CERTIFICATION',
    'CLEARANCE',
    'LICENSE',
    'CERTIFICATION_CIVILIAN',
  ];

  if (!type) errors.push('credential type is required');
  if (type && !validTypes.includes(type)) errors.push(`invalid credential type: ${type}`);
  if (!code) errors.push('credential code is required');

  if (errors.length > 0) {
    return { errors, credentialType: null, credentialCode: null };
  }

  return {
    errors: [],
    credentialType: type,
    credentialCode: code,
    title: String(credential.title || '').trim() || null,
    description: String(credential.description || '').trim() || null,
    issuedDate: credential.issuedDate || null,
    expirationDate: credential.expirationDate || null,
    issuingAuthority: String(credential.issuingAuthority || '').trim() || null,
    certificationNumber: String(credential.certificationNumber || '').trim() || null,
    status: normalizeStatus(credential.status),
    civEquivalent: String(credential.civEquivalent || '').trim() || null,
    verificationUrl: String(credential.verificationUrl || '').trim() || null,
  };
}

function normalizeStatus(status) {
  const s = String(status || 'ACTIVE').trim().toUpperCase();
  const statuses = ['ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED', 'PENDING'];
  return statuses.includes(s) ? s : 'ACTIVE';
}

function getVeteranCredentials(veteranId) {
  const record = militaryCertifications.get(veteranId);
  return record ? [...record.credentials] : [];
}

function getCredentialsByType(veteranId, credentialType) {
  const record = militaryCertifications.get(veteranId);
  if (!record) return [];
  return record.indexedByType.get(String(credentialType).toUpperCase()) || [];
}

function validateCredentialChain(veteranId, requiredCredentials = []) {
  const result = {
    isValid: true,
    missingCredentials: [],
    warnings: [],
  };

  const veteranCreds = getVeteranCredentials(veteranId);

  for (const required of requiredCredentials) {
    const typeStr = String(required.credentialType || required.type || '').toUpperCase();
    const codeStr = String(required.credentialCode || required.code || '').toUpperCase();

    const found = veteranCreds.find(
      (c) => c.credentialType === typeStr && c.credentialCode === codeStr
    );

    if (!found) {
      result.isValid = false;
      result.missingCredentials.push({ type: typeStr, code: codeStr });
    } else if (found.status !== 'ACTIVE') {
      result.warnings.push(`credential ${typeStr}/${codeStr} is ${found.status}`);
    }
  }

  return result;
}

function clearCredentialingStore() {
  militaryCertifications.clear();
}

export {
  clearCredentialingStore,
  getCredentialsByType,
  getVeteranCredentials,
  normalizeCredential,
  normalizeStatus,
  registerCredential,
  validateCredentialChain,
};
