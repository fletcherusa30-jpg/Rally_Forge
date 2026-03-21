import express from "express";
import { asyncHandler } from "../core/index.js";
import { recalculateBenefits } from "../controllers/recalculateController.js";

const router = express.Router();

router.post(
  "/recalculate/:veteranId",
  asyncHandler(recalculateBenefits)
);

export default router;

