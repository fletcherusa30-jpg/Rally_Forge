const { query } = require('../db');

exports.appendEvent = async (req, res, next) => {
  try {
    const { actor_type, actor_id, event_name, entity_type, entity_id, request_id, source_ip, occurred_at, before_state, after_state, metadata } = req.body;
    const result = await query(
      `INSERT INTO cp.audit_events (actor_type, actor_id, event_name, entity_type, entity_id, request_id, source_ip, occurred_at, before_state, after_state, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [actor_type, actor_id, event_name, entity_type, entity_id, request_id, source_ip, occurred_at, JSON.stringify(before_state), JSON.stringify(after_state), JSON.stringify(metadata || {})]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createFlag = async (req, res, next) => {
  try {
    const { entity_type, entity_id, flag_code, severity, status, detected_at, resolved_at, resolution_notes, metadata } = req.body;
    const result = await query(
      `INSERT INTO cp.compliance_flags (entity_type, entity_id, flag_code, severity, status, detected_at, resolved_at, resolution_notes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [entity_type, entity_id, flag_code, severity, status, detected_at, resolved_at, resolution_notes, JSON.stringify(metadata || {})]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.resolveFlag = async (req, res, next) => {
  try {
    const { complianceFlagId } = req.params;
    const { status, resolved_at, resolution_notes } = req.body;
    const result = await query(
      `UPDATE cp.compliance_flags SET status = $2, resolved_at = $3, resolution_notes = $4 WHERE compliance_flag_id = $1 RETURNING *`,
      [complianceFlagId, status, resolved_at, resolution_notes]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Compliance flag not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

