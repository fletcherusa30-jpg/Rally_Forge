import express from "express";
import { asyncHandler } from "../core/index.js";
import { createOnboarding } from "../controllers/onboardingController.js";

const router = express.Router();

router.post(
  "/onboarding",
  asyncHandler(createOnboarding)
);

export default router;

