import { getOrComputeBenefits } from '../services/benefitsService.js';

export async function getBenefitsByVeteranId(req, res) {
  const benefitsResult = await getOrComputeBenefits(req.params.veteranId);
  res.json({ success: true, data: benefitsResult });
}
