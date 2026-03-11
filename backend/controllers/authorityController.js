import { analyzeAuthorityText, searchAuthorityText } from '../services/authorityService.js';

export async function analyzeAuthority(req, res) {
  const data = analyzeAuthorityText(req.body?.text || '');
  res.json({ success: true, data });
}

export async function searchAuthority(req, res) {
  const data = searchAuthorityText(req.body?.text || '', req.body?.query || '', req.body?.maxResults);
  res.json({ success: true, data });
}
