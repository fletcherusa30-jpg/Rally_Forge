const { query } = require('../db');

exports.createClaim = async (req, res, next) => {
  try {
    const { veteran_id, claim_number, program, claim_type, source_channel, date_received, date_established, current_status, station_of_jurisdiction, end_product_code, suspense_date } = req.body;
    const result = await query(
      `INSERT INTO cp.claims (veteran_id, claim_number, program, claim_type, source_channel, date_received, date_established, current_status, station_of_jurisdiction, end_product_code, suspense_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [veteran_id, claim_number, program, claim_type, source_channel, date_received, date_established, current_status, station_of_jurisdiction, end_product_code, suspense_date]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getClaim = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const result = await query('SELECT * FROM cp.claims WHERE claim_id = $1', [claimId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateClaim = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const fields = req.body;
    const setClauses = Object.keys(fields).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [claimId, ...Object.values(fields)];
    const result = await query(
      `UPDATE cp.claims SET ${setClauses} WHERE claim_id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addStatusTransition = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const { status, started_at, changed_by, reason } = req.body;
    const result = await query(
      `INSERT INTO cp.claim_status_history (claim_id, status, started_at, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [claimId, status, started_at, changed_by, reason]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getStatusHistory = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const result = await query(
      'SELECT * FROM cp.claim_status_history WHERE claim_id = $1 ORDER BY started_at DESC',
      [claimId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.addContention = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const { contention_code, contention_name, contention_type, body_system, is_bilateral, side, diagnostic_code, date_claimed } = req.body;
    const result = await query(
      `INSERT INTO cp.contentions (claim_id, contention_code, contention_name, contention_type, body_system, is_bilateral, side, diagnostic_code, date_claimed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [claimId, contention_code, contention_name, contention_type, body_system, is_bilateral, side, diagnostic_code, date_claimed]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateContention = async (req, res, next) => {
  try {
    const { claimId, contentionId } = req.params;
    const fields = req.body;
    const setClauses = Object.keys(fields).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [contentionId, ...Object.values(fields)];
    const result = await query(
      `UPDATE cp.contentions SET ${setClauses} WHERE contention_id = $1 AND claim_id = $2 RETURNING *`,
      [contentionId, claimId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contention not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addEvidence = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const { evidence_type, title, source, received_date, document_date, is_material, relevance_score, metadata } = req.body;
    const result = await query(
      `INSERT INTO cp.evidence_items (claim_id, evidence_type, title, source, received_date, document_date, is_material, relevance_score, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [claimId, evidence_type, title, source, received_date, document_date, is_material, relevance_score, JSON.stringify(metadata || {})]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.linkEvidence = async (req, res, next) => {
  try {
    const { contentionId, evidenceId } = req.params;
    const { relation_type } = req.body;
    const result = await query(
      `INSERT INTO cp.contention_evidence (contention_id, evidence_id, relation_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [contentionId, evidenceId, relation_type]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

