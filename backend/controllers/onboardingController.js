import { createOrUpdateOnboarding } from '../services/onboardingService.js';

export async function createOnboarding(req, res) {
  const result = await createOrUpdateOnboarding(req.body);
  res.status(201).json({ success: true, data: result });
}
