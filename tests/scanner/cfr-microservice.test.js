import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadCfrIndex,
  getCfrPart,
  getCfrSection,
  getCfrSectionForDiagnosticCode,
  getDbqLinkByDxCode,
  parseEcfrUrl,
} from '../../backend/services/cfrIndexService.js';

test('local CFR index contains Title 38 Parts 3 and 4', async () => {
  const { index } = await loadCfrIndex();
  assert.equal(index.cfrIndex.title, 38);

  const part3 = await getCfrPart(3);
  const part4 = await getCfrPart(4);

  assert.ok(part3, 'part 3 should exist');
  assert.ok(part4, 'part 4 should exist');
  assert.ok((part3.sections || []).length > 0, 'part 3 should include sections');
  assert.ok((part4.sections || []).length > 0, 'part 4 should include sections');
});

test('local CFR section lookup works by part and section number', async () => {
  const section = await getCfrSection({ partNumber: 3, sectionNumber: '3.303' });
  assert.ok(section, 'expected section 3.303 to be present');
  assert.equal(section.partNumber, 3);
  assert.equal(String(section.sectionNumber).toLowerCase(), '3.303');
});

test('eCFR URL parsing maps title/part/section deterministically', () => {
  const parsed = parseEcfrUrl('https://www.ecfr.gov/current/title-38/chapter-I/part-3/section-3.159');
  assert.equal(parsed.title, 38);
  assert.equal(parsed.part, 3);
  assert.equal(parsed.section, '3.159');
});

test('DBQ link mapping includes local cfrLink metadata when available', async () => {
  const link = await getDbqLinkByDxCode('5237');
  assert.ok(link, 'expected DBQ link for DX 5237');
  assert.equal(link.cfrLink.title, 38);
  assert.ok(link.cfrLink.part === 4 || link.cfrLink.part === null);
  assert.ok(Object.prototype.hasOwnProperty.call(link.cfrLink, 'localSectionId'));
});

test('diagnostic-code to CFR section lookup returns local section metadata when indexed', async () => {
  const section = await getCfrSectionForDiagnosticCode('5237');
  if (section) {
    assert.equal(section.partNumber, 4);
    assert.ok(section.sectionNumber);
  } else {
    assert.equal(section, null);
  }
});
