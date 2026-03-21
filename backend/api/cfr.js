import express from 'express';
import {
  getCfrPart,
  getCfrSection,
  getCfrSectionForDiagnosticCode,
  getDbqLinksForSection,
  getDbqLinkByDxCode,
  loadCfrIndex,
} from '../services/cfrIndexService.js';

const router = express.Router();

router.get('/status', async (_req, res) => {
  const { index } = await loadCfrIndex();
  const parts = index?.cfrIndex?.parts || [];
  res.json({
    success: true,
    source: 'local-cfr-index-only',
    title: index?.cfrIndex?.title || 38,
    parts: parts.map((part) => ({
      partNumber: part?.partNumber,
      partTitle: part?.partTitle,
      sectionCount: (part?.sections || []).length,
    })),
    metadata: index?.metadata || {},
  });
});

router.get('/38/part/:partNumber', async (req, res) => {
  const partNumber = Number(req.params.partNumber);
  if (!Number.isFinite(partNumber)) {
    return res.status(400).json({ success: false, error: 'partNumber must be numeric.' });
  }

  const part = await getCfrPart(partNumber);
  if (!part) {
    return res.status(404).json({ success: false, error: `Part ${partNumber} not found.` });
  }

  return res.json({
    success: true,
    source: 'local-cfr-index-only',
    title: 38,
    part: {
      partNumber: part.partNumber,
      partTitle: part.partTitle,
      sections: (part.sections || []).map((section) => ({
        id: section.id,
        sectionNumber: section.sectionNumber,
        sectionTitle: section.sectionTitle,
        headings: section.headings || [],
        paragraphIdentifiers: (section.paragraphStructure || []).map((p) => p.label),
        diagnosticCodeRefs: section.diagnosticCodeRefs || [],
        rawTextLocation: section.rawTextLocation || null,
      })),
    },
  });
});

router.get('/38/part/:partNumber/section/:sectionNumber', async (req, res) => {
  const partNumber = Number(req.params.partNumber);
  const sectionNumber = String(req.params.sectionNumber || '');

  if (!Number.isFinite(partNumber)) {
    return res.status(400).json({ success: false, error: 'partNumber must be numeric.' });
  }

  const section = await getCfrSection({ partNumber, sectionNumber });
  if (!section) {
    return res.status(404).json({ success: false, error: `Section ${sectionNumber} not found in part ${partNumber}.` });
  }

  const links = await getDbqLinksForSection(section.id);

  return res.json({
    success: true,
    source: 'local-cfr-index-only',
    title: 38,
    part: partNumber,
    section: {
      id: section.id,
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      headings: section.headings || [],
      paragraphStructure: section.paragraphStructure || [],
      diagnosticCodeRefs: section.diagnosticCodeRefs || [],
      dbqLinkedDxCodes: links.map((entry) => entry.dxCode).filter(Boolean),
      rawTextLocation: section.rawTextLocation || null,
      confidence: section.confidence ?? null,
    },
  });
});

router.get('/38/part/4/dx/:dxCode', async (req, res) => {
  const dxCode = String(req.params.dxCode || '');
  const section = await getCfrSectionForDiagnosticCode(dxCode);
  const dbqLink = await getDbqLinkByDxCode(dxCode);

  if (!section && !dbqLink) {
    return res.status(404).json({ success: false, error: `No local CFR mapping found for diagnostic code ${dxCode}.` });
  }

  return res.json({
    success: true,
    source: 'local-cfr-index-only',
    title: 38,
    diagnosticCode: dxCode,
    cfrLink: dbqLink?.cfrLink || null,
    section: section
      ? {
          id: section.id,
          partNumber: section.partNumber,
          sectionNumber: section.sectionNumber,
          sectionTitle: section.sectionTitle,
          headings: section.headings || [],
          paragraphStructure: section.paragraphStructure || [],
          diagnosticCodeRefs: section.diagnosticCodeRefs || [],
          rawTextLocation: section.rawTextLocation || null,
          confidence: section.confidence ?? null,
        }
      : null,
  });
});

export default router;
