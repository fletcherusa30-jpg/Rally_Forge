import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadKnowledgeLibraryBase,
  getKnowledgeLibraryStatus,
  validateKnowledgeNodes,
  queryKnowledgeNodes,
  buildDecisionTrace,
  buildEvidenceChecklist,
} from '../services/knowledgeLibraryService.js';

test('knowledge library base loads canonical files', async () => {
  const base = await loadKnowledgeLibraryBase();
  assert.ok(base.schema);
  assert.ok(base.taxonomy);
  assert.ok(Array.isArray(base.nodes));
  assert.ok(base.nodes.length > 0);
  assert.ok(base.manifest);
});

test('knowledge library schema validation passes for seed nodes', async () => {
  const base = await loadKnowledgeLibraryBase();
  const result = validateKnowledgeNodes(base.schema, base.nodes);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('knowledge query returns deterministic matches', async () => {
  const base = await loadKnowledgeLibraryBase();
  const result = queryKnowledgeNodes(base.nodes, {
    domains: ['service_connection'],
    tags: ['direct'],
    condition: 'any',
  });
  assert.ok(result.length > 0);
  assert.ok(result.some((node) => node.id === 'sc.direct.3_303'));
});

test('decision trace and evidence checklist are deterministic', async () => {
  const base = await loadKnowledgeLibraryBase();
  const trace = buildDecisionTrace(base.nodes, {
    nodeId: 'sc.direct.3_303',
  });
  assert.deepEqual(trace.matchedNodeIds, ['sc.direct.3_303']);

  const checklist = buildEvidenceChecklist(base.nodes, {
    condition: 'any',
    pathway: 'direct',
  });
  assert.ok(Array.isArray(checklist.checklist));
  assert.ok(checklist.checklist.includes('current_diagnosis'));
});

test('knowledge library status reports manifest and validation summary', async () => {
  const status = await getKnowledgeLibraryStatus();
  assert.ok(status.manifest);
  assert.ok(typeof status.nodeCount === 'number');
  assert.equal(status.validation.valid, true);
});
