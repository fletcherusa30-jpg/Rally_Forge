import express from "express";
import { asyncHandler } from "../core/index.js";
import { analyzeAuthority, searchAuthority } from "../controllers/authorityController.js";

const router = express.Router();

router.post(
  "/authority/analyze-text",
  asyncHandler(analyzeAuthority)
);

router.post(
  "/authority/search-text",
  asyncHandler(searchAuthority)
);

export default router;

