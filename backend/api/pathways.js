import express from "express";
import { asyncHandler } from "../core/index.js";
import { classifyPathways } from "../controllers/pathwaysController.js";

const router = express.Router();

router.post(
  "/classify",
  asyncHandler(classifyPathways)
);

export default router;

