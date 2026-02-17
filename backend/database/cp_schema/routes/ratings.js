const { query } = require('../db');

exports.createRatingDecision = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const { decision_type, decision_date, notification_date, promulgation_date, signed_by, quality_review_flag, narrative_document_id, notes } = req.body;
    const result = await query(
      `INSERT INTO cp.rating_decisions (claim_id, decision_type, decision_date, notification_date, promulgation_date, signed_by, quality_review_flag, narrative_document_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [claimId, decision_type, decision_date, notification_date, promulgation_date, signed_by, quality_review_flag, narrative_document_id, notes]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addRatingIssue = async (req, res, next) => {
  try {
    const { ratingDecisionId } = req.params;
    const { contention_id, issue_name, disposition, service_connected, diagnostic_code, percentage_assigned, effective_date, bilateral_factor_applied, denial_reason_text, rationale_text } = req.body;
    const result = await query(
      `INSERT INTO cp.rating_issues (rating_decision_id, contention_id, issue_name, disposition, service_connected, diagnostic_code, percentage_assigned, effective_date, bilateral_factor_applied, denial_reason_text, rationale_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [ratingDecisionId, contention_id, issue_name, disposition, service_connected, diagnostic_code, percentage_assigned, effective_date, bilateral_factor_applied, denial_reason_text, rationale_text]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.upsertCombinedRating = async (req, res, next) => {
  try {
    const { ratingDecisionId } = req.params;
    const { computed_combined_percent, stated_combined_percent, bilateral_factor_percent, smc_code, compensation_level } = req.body;
    const result = await query(
      `INSERT INTO cp.combined_ratings (rating_decision_id, computed_combined_percent, stated_combined_percent, bilateral_factor_percent, smc_code, compensation_level)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (rating_decision_id) DO UPDATE SET
         computed_combined_percent = EXCLUDED.computed_combined_percent,
         stated_combined_percent = EXCLUDED.stated_combined_percent,
         bilateral_factor_percent = EXCLUDED.bilateral_factor_percent,
         smc_code = EXCLUDED.smc_code,
         compensation_level = EXCLUDED.compensation_level
       RETURNING *`,
      [ratingDecisionId, computed_combined_percent, stated_combined_percent, bilateral_factor_percent, smc_code, compensation_level]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addCitation = async (req, res, next) => {
  try {
    const { ratingIssueId } = req.params;
    const { authority_type, citation, authority_title, excerpt } = req.body;
    const result = await query(
      `INSERT INTO cp.decision_citations (rating_issue_id, authority_type, citation, authority_title, excerpt)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ratingIssueId, authority_type, citation, authority_title, excerpt]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.mapAuthority = async (req, res, next) => {
  try {
    const { ratingIssueId, authorityCitationId } = req.params;
    const { relation_strength } = req.body;
    const result = await query(
      `INSERT INTO cp.issue_authority_map (rating_issue_id, authority_citation_id, relation_strength)
       VALUES ($1, $2, $3)
       ON CONFLICT (rating_issue_id, authority_citation_id) DO UPDATE SET relation_strength = EXCLUDED.relation_strength
       RETURNING *`,
      [ratingIssueId, authorityCitationId, relation_strength || 1]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getLatestDecision = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const result = await query(
      'SELECT * FROM cp.rating_decisions WHERE claim_id = $1 ORDER BY decision_date DESC LIMIT 1',
      [claimId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No rating decision found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
