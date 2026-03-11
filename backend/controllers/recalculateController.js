import { recomputeBenefits } from '../services/benefitsService.js';

export async function recalculateBenefits(req, res) {
  const benefitsResult = await recomputeBenefits(req.params.veteranId);
  res.json({ success: true, data: benefitsResult });
}
