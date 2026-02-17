import express from "express";
import { asyncHandler } from "../utils/errors.js";
import { analyzeAuthorityText, searchAuthorityText } from "../services/authorityService.js";

const router = express.Router();

router.post(
  "/authority/analyze-text",
  asyncHandler(async (req, res) => {
    const data = analyzeAuthorityText(req.body?.text || "");
    res.json({ success: true, data });
  })
);

router.post(
  "/authority/search-text",
  asyncHandler(async (req, res) => {
    const data = searchAuthorityText(req.body?.text || "", req.body?.query || "", req.body?.maxResults);
    res.json({ success: true, data });
  })
);

export default router;
