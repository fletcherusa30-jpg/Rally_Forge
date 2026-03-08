const { query } = require('../db');

exports.createVeteran = async (req, res, next) => {
  try {
    const { va_file_number, first_name, middle_name, last_name, suffix, date_of_birth, date_of_death, sex_at_birth } = req.body;
    const result = await query(
      `INSERT INTO cp.veterans (va_file_number, first_name, middle_name, last_name, suffix, date_of_birth, date_of_death, sex_at_birth)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [va_file_number, first_name, middle_name, last_name, suffix, date_of_birth, date_of_death, sex_at_birth]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getVeteran = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const result = await query('SELECT * FROM cp.veterans WHERE veteran_id = $1', [veteranId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Veteran not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateVeteran = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const fields = req.body;
    const setClauses = Object.keys(fields).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [veteranId, ...Object.values(fields)];
    const result = await query(
      `UPDATE cp.veterans SET ${setClauses} WHERE veteran_id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Veteran not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getServicePeriods = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const result = await query('SELECT * FROM cp.service_periods WHERE veteran_id = $1 ORDER BY start_date DESC', [veteranId]);
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.addServicePeriod = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const { branch, service_component, start_date, end_date, characterization, pay_grade, theater, deployed } = req.body;
    const result = await query(
      `INSERT INTO cp.service_periods (veteran_id, branch, service_component, start_date, end_date, characterization, pay_grade, theater, deployed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [veteranId, branch, service_component, start_date, end_date, characterization, pay_grade, theater, deployed]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getRepresentatives = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const result = await query(
      `SELECT vr.*, r.* FROM cp.veteran_representatives vr
       JOIN cp.representatives r ON vr.representative_id = r.representative_id
       WHERE vr.veteran_id = $1 AND vr.is_active = true
       ORDER BY vr.effective_from DESC`,
      [veteranId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.upsertRepresentative = async (req, res, next) => {
  try {
    const { veteranId, representativeId } = req.params;
    const { poa_form_code, effective_from, effective_to, is_active } = req.body;
    const result = await query(
      `INSERT INTO cp.veteran_representatives (veteran_id, representative_id, poa_form_code, effective_from, effective_to, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (veteran_id, representative_id)
       DO UPDATE SET poa_form_code = EXCLUDED.poa_form_code, effective_from = EXCLUDED.effective_from, effective_to = EXCLUDED.effective_to, is_active = EXCLUDED.is_active
       RETURNING *`,
      [veteranId, representativeId, poa_form_code, effective_from, effective_to, is_active]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

