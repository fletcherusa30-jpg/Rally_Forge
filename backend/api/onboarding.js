import express from "express";
import { asyncHandler } from "../utils/errors.js";
import { createOrUpdateOnboarding } from "../services/onboardingService.js";

const router = express.Router();

router.post(
  "/onboarding",
  asyncHandler(async (req, res) => {
    const result = await createOrUpdateOnboarding(req.body);
    res.status(201).json({ success: true, data: result });
  })
);

export default router;

