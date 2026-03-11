import express from "express";
import { asyncHandler } from "../core/index.js";
import { getBenefitsByVeteranId } from "../controllers/benefitsController.js";

const router = express.Router();

router.get(
  "/benefits/:veteranId",
  asyncHandler(getBenefitsByVeteranId)
);

export default router;

