import express from 'express';
import { scanVaDecision } from '../va_scanner/engine/vaSuperScanner.js';
import cfrParser from '../va_scanner/engine/cfr-rating-parser.js';
const { COMBINED_RATINGS_TABLE, BILATERAL_FACTOR } = cfrParser;
import { enhanceWithPACTActFlags, generatePACTActSummary } from '../va_scanner/frontend/utils/pactActDetection.js';

const router = express.Router();

/**
 * POST /api/scan-va-decision
 * 
 * Production-grade VA Rating Decision Scanner API
 * Accepts raw decision text and returns structured analysis
 * 
 * Request: { "rawText": "..." }
 * Response: { success, conditions, deniedConditions, combinedRating, smcAwards, ancillaryBenefits, pactAct, meta }
 */
router.post('/scan-va-decision', (req, res) => {
  const startTime = Date.now();
  
  try {
    const { rawText } = req.body;

    // Log incoming request
    console.log('[VA Decision Scanner] Received scan request');
    console.log('[VA Decision Scanner] Raw text length:', rawText?.length || 0);

    // Validate input
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      console.warn('[VA Decision Scanner] Missing or empty rawText');
      return res.status(400).json({
        success: false,
        error: 'Missing or empty rawText. Please provide decision text.',
        code: 'EMPTY_INPUT'
      });
    }

    if (rawText.trim().length < 20) {
      console.warn('[VA Decision Scanner] Text too short');
      return res.status(400).json({
        success: false,
        error: 'Decision text too short. Minimum 20 characters required.',
        code: 'TEXT_TOO_SHORT'
      });
    }

    // Call the scanner engine
    console.log('[VA Decision Scanner] Calling scanner engine...');
    const scanResult = scanVaDecision(rawText);

    // Transform to API contract format
    const response = transformToApiContract(scanResult, startTime);

    // Log success
    console.log('[VA Decision Scanner] Scan complete');
    console.log('[VA Decision Scanner] Conditions found:', response.conditions.length);
    console.log('[VA Decision Scanner] Denied conditions:', response.deniedConditions.length);
    console.log('[VA Decision Scanner] Combined rating:', response.combinedRating?.percent || 0);
    console.log('[VA Decision Scanner] Processing time:', response.meta.processingMs, 'ms');

    return res.json(response);
  } catch (err) {
    console.error('[VA Decision Scanner] Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error while processing decision.',
      code: 'PROCESSING_ERROR'
    });
  }
});

/**
 * Transform scanner engine output to match the API contract
 */
function transformToApiContract(scanResult, startTime) {
  // Extract service-connected conditions
  let conditions = [];
  if (scanResult.serviceConnected?.conditions) {
    scanResult.serviceConnected.conditions.forEach(item => {
      conditions.push({
        name: item.condition || item.name || 'Unknown Condition',
        diagnosticCode: item.diagnosticCode || null,
        evaluationPercent: parseInt(item.rating || item.percent || item.evaluationPercent || 0),
        effectiveDate: item.effectiveDate || null,
        bodySystem: item.bodySystem || null,
        isServiceConnected: true,
        isBilateral: item.isBilateral || false,
        laterality: item.laterality || null
      });
    });
  }
  
  // Enhance with PACT Act flags
  conditions = enhanceWithPACTActFlags(conditions, scanResult.rawText || '');

  // Extract denied conditions
  const deniedConditions = [];
  if (scanResult.denied?.conditions) {
    scanResult.denied.conditions.forEach(item => {
      deniedConditions.push({
        name: item.condition || item.name || 'Unknown Condition',
        denialReasons: item.reasons || item.denialReasons || ['No specific reason provided'],
        sourceText: item.sourceText || '',
        denialBasis: item.denialBasis || item.basis || ''
      });
    });
  }

  // Extract ancillary benefits
  const ancillaryBenefits = [];
  if (scanResult.ancillaryBenefits?.benefits) {
    scanResult.ancillaryBenefits.benefits.forEach(item => {
      ancillaryBenefits.push({
        name: item.name || item.benefit || 'Unknown Benefit',
        status: item.status || 'potential',
        effectiveDate: item.effectiveDate || null,
        basis: item.basis || item.reason || '',
        sourceText: item.sourceText || ''
      });
    });
  }

  // Extract SMC awards
  const smcAwards = [];
  if (scanResult.smcAwards?.awards) {
    scanResult.smcAwards.awards.forEach(item => {
      smcAwards.push({
        level: item.level || item.smcLevel || 'Unknown',
        basis: item.basis || item.reason || 'SMC Award',
        amount: item.amount || null,
        effectiveDate: item.effectiveDate || null,
        sourceText: item.sourceText || ''
      });
    });
  }

  // Calculate CFR-compliant combined rating with bilateral factor (38 CFR § 4.25 & § 4.26)
  const ratings = conditions
    .filter(c => c.evaluationPercent > 0)
    .map(c => c.evaluationPercent);
  
  // Check for bilateral conditions per 38 CFR § 4.26
  const bilateralConditions = conditions.filter(c => c.isBilateral && c.evaluationPercent > 0);
  let bilateralFactor = 0;
  let bilateralBonus = 0;
  
  if (bilateralConditions.length >= 2) {
    // Calculate bilateral factor (10% of combined bilateral ratings)
    const bilateralRatings = bilateralConditions.map(c => c.evaluationPercent);
    const combinedBilateral = COMBINED_RATINGS_TABLE.combineMultiple(bilateralRatings);
    bilateralBonus = BILATERAL_FACTOR.calculateBonus(combinedBilateral);
    bilateralFactor = bilateralBonus;
    
    // Add bilateral factor to ratings for final combination
    if (bilateralBonus > 0) {
      ratings.push(bilateralBonus);
    }
  }
  
  // Use official CFR § 4.25 combined ratings table
  const cfrCombinedRating = COMBINED_RATINGS_TABLE.combineMultiple(ratings);
  
  const combinedRating = {
    percent: cfrCombinedRating,
    steps: ratings.map((r, i) => ({
      rating: r,
      condition: i < conditions.length ? conditions[i].name : 'Bilateral Factor',
      isBilateralFactor: i >= conditions.length
    })),
    bilateralFactor: bilateralFactor,
    bilateralBonus: bilateralBonus,
    method: 'CFR § 4.25 Official Table' + (bilateralFactor > 0 ? ' + § 4.26 Bilateral Factor' : '')
  };

  // Generate PACT Act summary
  const pactActSummary = generatePACTActSummary(conditions);

  // Build response matching API contract
  return {
    success: true,
    conditions,
    deniedConditions,
    combinedRating,
    smcAwards,
    ancillaryBenefits,
    pactAct: pactActSummary,
    meta: {
      processingMs: Date.now() - startTime,
      version: '3.3.0-cfr-pact',
      itemsExtracted: conditions.length + deniedConditions.length + ancillaryBenefits.length,
      cfrCompliant: true,
      bilateralFactorApplied: combinedRating.bilateralBonus > 0,
      pactActScanned: true
    }
  };
}

export default router;

