import express from "express";
import { asyncHandler } from "../core/index.js";
import { analyzeAuthority, searchAuthority } from "../controllers/authorityController.js";

const router = express.Router();

router.post(
  "/analyze-text",
  asyncHandler(analyzeAuthority)
);

router.post(
  "/search-text",
  asyncHandler(searchAuthority)
);

export default router;

