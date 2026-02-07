import express from "express";
import { asyncHandler } from "../utils/errors.js";
import { recomputeBenefits } from "../services/benefitsService.js";

const router = express.Router();

router.post(
  "/benefits/recalculate/:veteranId",
  asyncHandler(async (req, res) => {
    const benefitsResult = await recomputeBenefits(req.params.veteranId);
    res.json({ success: true, data: benefitsResult });
  })
);

export default router;
