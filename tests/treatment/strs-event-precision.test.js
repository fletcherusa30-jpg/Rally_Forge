import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeText, scanSTRText } from '../../backend/engine/strs/strs-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldsetPath = path.join(__dirname, 'fixtures', 'strs-event-goldset.json');

const goldset = JSON.parse(fs.readFileSync(goldsetPath, 'utf8'));

function extractEventLabels(text) {
  const result = scanSTRText(normalizeText(text));
  return (result?.Extracted?.Events || []).map((event) => event.label);
}

test('STR event precision gold set', async (t) => {
  for (const entry of goldset.cases) {
    await t.test(entry.id, () => {
      const labels = extractEventLabels(entry.text);

      for (const expectedLabel of entry.expectPresent || []) {
        assert.ok(
          labels.includes(expectedLabel),
          `${entry.id}: expected event '${expectedLabel}' but found [${labels.join(', ')}]`
        );
      }

      for (const unexpectedLabel of entry.expectAbsent || []) {
        assert.ok(
          !labels.includes(unexpectedLabel),
          `${entry.id}: unexpected event '${unexpectedLabel}' found in [${labels.join(', ')}]`
        );
      }
    });
  }
});
