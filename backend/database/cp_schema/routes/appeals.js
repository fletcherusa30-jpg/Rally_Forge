const { query } = require('../db');

exports.createAppeal = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const { rating_decision_id, lane, docket_number, date_received, current_status, disposition_date, disposition_summary } = req.body;
    const result = await query(
      `INSERT INTO cp.appeals (claim_id, rating_decision_id, lane, docket_number, date_received, current_status, disposition_date, disposition_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [claimId, rating_decision_id, lane, docket_number, date_received, current_status, disposition_date, disposition_summary]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateAppeal = async (req, res, next) => {
  try {
    const { appealId } = req.params;
    const fields = req.body;
    const setClauses = Object.keys(fields).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [appealId, ...Object.values(fields)];
    const result = await query(
      `UPDATE cp.appeals SET ${setClauses} WHERE appeal_id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appeal not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addAppealIssue = async (req, res, next) => {
  try {
    const { appealId } = req.params;
    const { rating_issue_id, issue_name, sought_outcome, board_disposition, remand_reason } = req.body;
    const result = await query(
      `INSERT INTO cp.appeal_issues (appeal_id, rating_issue_id, issue_name, sought_outcome, board_disposition, remand_reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [appealId, rating_issue_id, issue_name, sought_outcome, board_disposition, remand_reason]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.scheduleHearing = async (req, res, next) => {
  try {
    const { appealId } = req.params;
    const { hearing_type, scheduled_at, held_at, location, presiding_official, transcript_document_id, outcome_notes } = req.body;
    const result = await query(
      `INSERT INTO cp.hearings (appeal_id, hearing_type, scheduled_at, held_at, location, presiding_official, transcript_document_id, outcome_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [appealId, hearing_type, scheduled_at, held_at, location, presiding_official, transcript_document_id, outcome_notes]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateHearing = async (req, res, next) => {
  try {
    const { hearingId } = req.params;
    const fields = req.body;
    const setClauses = Object.keys(fields).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [hearingId, ...Object.values(fields)];
    const result = await query(
      `UPDATE cp.hearings SET ${setClauses} WHERE hearing_id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Hearing not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.listAppeals = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const result = await query('SELECT * FROM cp.appeals WHERE claim_id = $1 ORDER BY date_received DESC', [claimId]);
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
};

