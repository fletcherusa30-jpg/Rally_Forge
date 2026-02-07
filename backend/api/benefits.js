import express from "express";
import { asyncHandler } from "../utils/errors.js";
import { getOrComputeBenefits } from "../services/benefitsService.js";

const router = express.Router();

router.get(
  "/benefits/:veteranId",
  asyncHandler(async (req, res) => {
    const benefitsResult = await getOrComputeBenefits(req.params.veteranId);
    res.json({ success: true, data: benefitsResult });
  })
);

export default router;
