import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge');

const FILES = {
  schema: 'knowledge-node.schema.json',
  taxonomy: 'knowledge-taxonomy-map.json',
  nodes: 'knowledge-nodes.json',
  manifest: 'knowledge-release-manifest.json',
};

const cache = {
  schema: null,
  taxonomy: null,
  nodes: null,
  manifest: null,
};

async function readJson(name) {
  const filePath = path.join(KNOWLEDGE_DIR, name);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function includesAny(haystack, terms) {
  const text = normalizeText(haystack);
  return terms.some((term) => text.includes(normalizeText(term)));
}

export async function loadKnowledgeLibraryBase() {
  if (!cache.schema) cache.schema = await readJson(FILES.schema);
  if (!cache.taxonomy) cache.taxonomy = await readJson(FILES.taxonomy);
  if (!cache.nodes) cache.nodes = await readJson(FILES.nodes);
  if (!cache.manifest) cache.manifest = await readJson(FILES.manifest);

  return {
    schema: cache.schema,
    taxonomy: cache.taxonomy,
    nodes: cache.nodes,
    manifest: cache.manifest,
  };
}

export function validateKnowledgeNodes(schema, nodes) {
  const required = Array.isArray(schema?.requiredFields) ? schema.requiredFields : [];
  const errors = [];

  (Array.isArray(nodes) ? nodes : []).forEach((node, index) => {
    required.forEach((field) => {
      if (node[field] === undefined || node[field] === null) {
        errors.push({ nodeIndex: index, nodeId: node?.id || null, field, message: 'Missing required field' });
      }
    });

    if (node?.effectiveRange) {
      const start = node.effectiveRange.start;
      const end = node.effectiveRange.end;
      if (!start || !end) {
        errors.push({ nodeIndex: index, nodeId: node?.id || null, field: 'effectiveRange', message: 'effectiveRange.start and effectiveRange.end are required' });
      }
    }
  });

  const ids = new Set();
  (Array.isArray(nodes) ? nodes : []).forEach((node, index) => {
    if (!node?.id) return;
    if (ids.has(node.id)) {
      errors.push({ nodeIndex: index, nodeId: node.id, field: 'id', message: 'Duplicate node id' });
    }
    ids.add(node.id);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function listKnowledgeNodes(nodes, options = {}) {
  const domain = normalizeText(options.domain || '');
  const authority = normalizeText(options.authority || '');
  const tag = normalizeText(options.tag || '');
  const q = normalizeText(options.q || '');

  return (Array.isArray(nodes) ? nodes : []).filter((node) => {
    if (domain && normalizeText(node.domain) !== domain) return false;
    if (authority && normalizeText(node.authority) !== authority) return false;
    if (tag && !Array.isArray(node.tags)) return false;
    if (tag && !node.tags.map(normalizeText).includes(tag)) return false;

    if (q) {
      const values = [node.title, node.citation, node.id, ...(Array.isArray(node.tags) ? node.tags : []), ...(Array.isArray(node.conditions) ? node.conditions : [])];
      return includesAny(values.join(' '), [q]);
    }

    return true;
  });
}

export function getKnowledgeNodeById(nodes, id) {
  return (Array.isArray(nodes) ? nodes : []).find((node) => node.id === id) || null;
}

export function queryKnowledgeNodes(nodes, input = {}) {
  const domains = Array.isArray(input.domains) ? input.domains.map(normalizeText) : [];
  const authorities = Array.isArray(input.authorities) ? input.authorities.map(normalizeText) : [];
  const tags = Array.isArray(input.tags) ? input.tags.map(normalizeText) : [];
  const condition = normalizeText(input.condition || '');

  return (Array.isArray(nodes) ? nodes : []).filter((node) => {
    if (domains.length > 0 && !domains.includes(normalizeText(node.domain))) return false;
    if (authorities.length > 0 && !authorities.includes(normalizeText(node.authority))) return false;

    if (tags.length > 0) {
      const nodeTags = Array.isArray(node.tags) ? node.tags.map(normalizeText) : [];
      if (!tags.some((tag) => nodeTags.includes(tag))) return false;
    }

    if (condition) {
      const conditions = Array.isArray(node.conditions) ? node.conditions.map(normalizeText) : [];
      if (!(conditions.includes('any') || conditions.includes(condition))) {
        return false;
      }
    }

    return true;
  });
}

export function buildDecisionTrace(nodes, payload = {}) {
  const nodeId = payload.nodeId || null;
  const condition = normalizeText(payload.condition || '');
  const matched = nodeId
    ? (getKnowledgeNodeById(nodes, nodeId) ? [getKnowledgeNodeById(nodes, nodeId)] : [])
    : queryKnowledgeNodes(nodes, {
        domains: payload.domains || ['service_connection', 'exposure', 'rating'],
        tags: payload.tags || [],
        condition,
      }).slice(0, 8);

  return {
    inputs: {
      nodeId,
      condition: payload.condition || null,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
    },
    matchedNodeIds: matched.map((node) => node.id),
    trace: matched.map((node) => ({
      nodeId: node.id,
      title: node.title,
      citation: node.citation,
      authority: node.authority,
      decisionLogic: Array.isArray(node.decisionLogic) ? node.decisionLogic : [],
      requiredEvidence: Array.isArray(node.requiredEvidence) ? node.requiredEvidence : [],
      relatedNodes: Array.isArray(node.relatedNodes) ? node.relatedNodes : [],
    })),
  };
}

export function buildEvidenceChecklist(nodes, payload = {}) {
  const condition = normalizeText(payload.condition || '');
  const pathway = normalizeText(payload.pathway || '');

  const matched = queryKnowledgeNodes(nodes, {
    domains: ['service_connection', 'exposure', 'evidence_development'],
    tags: pathway ? [pathway] : [],
    condition,
  });

  const evidence = new Set();
  matched.forEach((node) => {
    (Array.isArray(node.requiredEvidence) ? node.requiredEvidence : []).forEach((item) => evidence.add(item));
  });

  return {
    condition: payload.condition || null,
    pathway: payload.pathway || null,
    matchedNodeIds: matched.map((node) => node.id),
    checklist: [...evidence].sort(),
  };
}

export async function getKnowledgeLibraryStatus() {
  const base = await loadKnowledgeLibraryBase();
  const validation = validateKnowledgeNodes(base.schema, base.nodes);

  return {
    manifest: base.manifest,
    schemaVersion: base.schema?.$schemaVersion || null,
    taxonomyVersion: base.taxonomy?.version || null,
    nodeCount: Array.isArray(base.nodes) ? base.nodes.length : 0,
    validation,
  };
}
