const { query } = require('../db');

exports.createProfile = async (req, res, next) => {
  try {
    const { veteranId } = req.params;
    const { pension_type, mapr_category, aid_and_attendance, housebound, dependent_count, effective_date, end_date } = req.body;
    const result = await query(
      `INSERT INTO cp.pension_profiles (veteran_id, pension_type, mapr_category, aid_and_attendance, housebound, dependent_count, effective_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [veteranId, pension_type, mapr_category, aid_and_attendance, housebound, dependent_count, effective_date, end_date]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { pensionProfileId } = req.params;
    const fields = req.body;
    const setClauses = Object.keys(fields).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [pensionProfileId, ...Object.values(fields)];
    const result = await query(
      `UPDATE cp.pension_profiles SET ${setClauses} WHERE pension_profile_id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pension profile not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addIncomeSource = async (req, res, next) => {
  try {
    const { pensionProfileId } = req.params;
    const { income_type, payer_name, frequency, gross_amount, countable_percent, effective_from, effective_to } = req.body;
    const result = await query(
      `INSERT INTO cp.pension_income_sources (pension_profile_id, income_type, payer_name, frequency, gross_amount, countable_percent, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [pensionProfileId, income_type, payer_name, frequency, gross_amount, countable_percent, effective_from, effective_to]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addAsset = async (req, res, next) => {
  try {
    const { pensionProfileId } = req.params;
    const { asset_type, description, fair_market_value, encumbrance_amount, ownership_percent, as_of_date } = req.body;
    const result = await query(
      `INSERT INTO cp.pension_assets (pension_profile_id, asset_type, description, fair_market_value, encumbrance_amount, ownership_percent, as_of_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pensionProfileId, asset_type, description, fair_market_value, encumbrance_amount, ownership_percent, as_of_date]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addDeduction = async (req, res, next) => {
  try {
    const { pensionProfileId } = req.params;
    const { deduction_type, annual_amount, effective_from, effective_to } = req.body;
    const result = await query(
      `INSERT INTO cp.pension_deductions (pension_profile_id, deduction_type, annual_amount, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [pensionProfileId, deduction_type, annual_amount, effective_from, effective_to]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addAward = async (req, res, next) => {
  try {
    const { pensionProfileId } = req.params;
    const { decision_date, mapr_amount, countable_income, net_worth_amount, annual_pension_amount, monthly_pension_amount } = req.body;
    const result = await query(
      `INSERT INTO cp.pension_awards (pension_profile_id, decision_date, mapr_amount, countable_income, net_worth_amount, annual_pension_amount, monthly_pension_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pensionProfileId, decision_date, mapr_amount, countable_income, net_worth_amount, annual_pension_amount, monthly_pension_amount]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
