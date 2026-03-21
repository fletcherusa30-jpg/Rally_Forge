import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getKnowledgeManifestIntegrity } from '../services/knowledgeManifestService.js';

test('knowledge manifest integrity resolves the active nested manifest', async () => {
  const result = await getKnowledgeManifestIntegrity();

  assert.equal(result.success, true);
  assert.equal(result.status, 'ok');
  assert.ok(result.manifestPath.endsWith('knowledge-release-manifest.json'));
  assert.ok(result.filesChecked > 0);
  assert.deepEqual(result.missingFiles, []);
  assert.deepEqual(result.checksums.mismatched, []);
});