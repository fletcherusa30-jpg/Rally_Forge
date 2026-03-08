import express from "express";
import { asyncHandler } from "../utils/errors.js";
import { determineClaimPathways, generateAppealsOptions } from "../engine/benefitsFlow.js";

const router = express.Router();

router.post(
  "/pathways/classify",
  asyncHandler(async (req, res) => {
    const { conditions, serviceInfo } = req.body;

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "conditions array is required and must not be empty"
      });
    }

    if (!serviceInfo) {
      return res.status(400).json({
        success: false,
        error: "serviceInfo object is required"
      });
    }

    // Classify all conditions into pathways
    const pathwayResults = determineClaimPathways({
      conditions,
      serviceInfo
    });

    // Generate appeals options if there are denied conditions
    const deniedConditions = conditions.filter(c => c.status === 'denied');
    const appealsOptions = deniedConditions.length > 0 
      ? generateAppealsOptions(deniedConditions)
      : null;

    res.json({
      success: true,
      data: {
        pathways: pathwayResults,
        appeals: appealsOptions,
        summary: {
          totalConditions: conditions.length,
          pactActCount: pathwayResults.pactAct.length,
          traditionalCount: pathwayResults.traditional.length,
          directCount: pathwayResults.direct.length,
          secondaryCount: pathwayResults.secondary.length,
          aggravationCount: pathwayResults.aggravation.length,
          deniedCount: pathwayResults.denied.length
        }
      }
    });
  })
);

export default router;

