import express from "express";
import { asyncHandler } from "../utils/errors.js";
import { getLatestScannerOutput, scanTextWithScanner } from "../services/scannerService.js";

const router = express.Router();

router.get(
  "/scanner/latest",
  asyncHandler(async (req, res) => {
    const data = await getLatestScannerOutput();
    res.json({ success: true, data });
  })
);

router.post(
  "/scanner/scan-text",
  asyncHandler(async (req, res) => {
    const data = await scanTextWithScanner(req.body?.text || "");
    res.json({ success: true, data });
  })
);

export default router;
