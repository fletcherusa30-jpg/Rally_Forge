const { query } = require('../db');

exports.createAccount = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const { account_type, institution_name, routing_last4, account_last4, active, start_date, end_date } = req.body;
    const result = await query(
      `INSERT INTO cp.payment_accounts (veteran_id, account_type, institution_name, routing_last4, account_last4, active, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [veteranId, account_type, institution_name, routing_last4, account_last4, active, start_date, end_date]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const { claim_id, payment_account_id, payment_type, payment_date, posted_at, amount, currency_code, reference_number, treasury_trace, status } = req.body;
    const result = await query(
      `INSERT INTO cp.payment_transactions (veteran_id, claim_id, payment_account_id, payment_type, payment_date, posted_at, amount, currency_code, reference_number, treasury_trace, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [veteranId, claim_id, payment_account_id, payment_type, payment_date, posted_at, amount, currency_code, reference_number, treasury_trace, status]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.listPayments = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const { from, to, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM cp.payment_transactions WHERE veteran_id = $1';
    const params = [veteranId];
    if (from) {
      params.push(from);
      sql += ` AND payment_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      sql += ` AND payment_date <= $${params.length}`;
    }
    sql += ` ORDER BY payment_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.createDebt = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const { originating_claim_id, debt_reason, principal_amount, interest_amount, balance_amount, established_date, waived } = req.body;
    const result = await query(
      `INSERT INTO cp.overpayment_debts (veteran_id, originating_claim_id, debt_reason, principal_amount, interest_amount, balance_amount, established_date, waived)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [veteranId, originating_claim_id, debt_reason, principal_amount, interest_amount, balance_amount, established_date, waived]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateDebt = async (req, res, next) => {
  try {
    const { overpaymentDebtId } = req.params;
    const fields = req.body;
    const setClauses = Object.keys(fields).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [overpaymentDebtId, ...Object.values(fields)];
    const result = await query(
      `UPDATE cp.overpayment_debts SET ${setClauses} WHERE overpayment_debt_id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Debt not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
