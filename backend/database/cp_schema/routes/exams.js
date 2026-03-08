import { query } from '../db.js';

export const createExam = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const { contention_id, exam_type, vendor_name, facility_name, request_date, scheduled_date, completed_date, examiner_name, examiner_specialty, status, dbq_form_code } = req.body;
    const result = await query(
      `INSERT INTO cp.cp_exams (claim_id, contention_id, exam_type, vendor_name, facility_name, request_date, scheduled_date, completed_date, examiner_name, examiner_specialty, status, dbq_form_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [claimId, contention_id, exam_type, vendor_name, facility_name, request_date, scheduled_date, completed_date, examiner_name, examiner_specialty, status, dbq_form_code]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const updateExam = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const fields = req.body;
    const setClauses = Object.keys(fields).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [examId, ...Object.values(fields)];
    const result = await query(
      `UPDATE cp.cp_exams SET ${setClauses} WHERE exam_id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const addFinding = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const { finding_code, finding_name, value_text, value_numeric, value_unit, is_positive, rationale } = req.body;
    const result = await query(
      `INSERT INTO cp.exam_findings (exam_id, finding_code, finding_name, value_text, value_numeric, value_unit, is_positive, rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [examId, finding_code, finding_name, value_text, value_numeric, value_unit, is_positive, rationale]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const listExams = async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const result = await query('SELECT * FROM cp.cp_exams WHERE claim_id = $1 ORDER BY request_date DESC', [claimId]);
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
};

