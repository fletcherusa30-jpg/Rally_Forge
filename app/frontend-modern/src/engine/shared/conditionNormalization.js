function asText(value) {
  return String(value || '').trim();
}

function stripDescriptors(value) {
  return value
    .replace(/\b(left|right|bilateral|chronic|acute|unspecified|condition|disorder|syndrome)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYNONYM_MAP = new Map([
  ['htn', 'hypertension'],
  ['high blood pressure', 'hypertension'],
  ['dm2', 'diabetes mellitus type 2'],
  ['type ii diabetes', 'diabetes mellitus type 2'],
  ['type 2 diabetes', 'diabetes mellitus type 2'],
  ['type ii diabetes mellitus', 'diabetes mellitus type 2'],
  ['ptsd', 'post-traumatic stress disorder'],
  ['post traumatic stress', 'post-traumatic stress disorder'],
  ['low back pain', 'lumbar spine condition'],
  ['lumbago', 'lumbar spine condition'],
  ['neck pain', 'cervical spine condition'],
  ['cervicalgia', 'cervical spine condition'],
  ['nerve impingement', 'radiculopathy'],
  ['radiculopathy', 'radiculopathy'],
  ['sensorineural hearing loss', 'hearing loss'],
  ['hearing loss', 'hearing loss'],
  ['ringing in ears', 'tinnitus'],
  ['tinnitus', 'tinnitus'],
  ['migraines', 'migraine headaches'],
  ['headaches', 'migraine headaches'],
]);

const FAMILY_OVERRIDES = [
  { family: 'spine', match: /\b(cervical|thoracic|lumbar|spine)\b/ },
  { family: 'mental health', match: /\b(post traumatic stress|post-traumatic stress disorder|ptsd|depression|anxiety)\b/ },
  { family: 'joints', match: /\b(knee|shoulder|ankle|wrist|joint)\b/ },
];

export function normalizeConditionName(value) {
  const lowered = asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!lowered) {
    return '';
  }

  const stripped = stripDescriptors(lowered);
  if (SYNONYM_MAP.has(stripped)) {
    return SYNONYM_MAP.get(stripped);
  }

  for (const [key, mapped] of SYNONYM_MAP.entries()) {
    if (stripped.includes(key)) {
      return mapped;
    }
  }

  return stripped;
}

export function normalizeConditionList(values = []) {
  const seen = new Set();
  const rows = [];
  values.forEach((value) => {
    const normalized = normalizeConditionName(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    rows.push(normalized);
  });
  return rows;
}

export function conditionKey(value) {
  return normalizeConditionName(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function conditionMatches(left, right) {
  const a = conditionKey(left);
  const b = conditionKey(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function getConditionFamily(value) {
  const normalized = conditionKey(value);
  const family = FAMILY_OVERRIDES.find((item) => item.match.test(normalized));
  return family ? family.family : '';
}
