import React, { useState } from 'react';
import styles from './BudgetPlanner.module.css';
import { useBudgetEngine } from './useBudgetEngine';
import { BudgetChart } from './BudgetChart';
import { DebtSummary } from './DebtSummary';

export function BudgetPlanner() {
  const { calculate, result } = useBudgetEngine();

  const [budget, setBudget] = useState({
    Income: {
      Salary: 6500,
      VA: 4400,
      MilitaryRetirement: 1600,
      SocialSecurity: 0,
      Other: 0,
    },
    FixedExpenses: {
      Mortgage: 1100,
      Insurance: 300,
      Utilities: 250,
      Phone: 120,
      Internet: 80,
    },
    VariableExpenses: {
      Food: 900,
      Gas: 300,
      Entertainment: 200,
      Misc: 150,
    },
    AnnualExpenses: {
      CarRegistration: 300,
      Holidays: 1500,
      PropertyTax: 1800,
    },
    Savings: {
      EmergencyFund: 500,
      Retirement: 1500,
      SinkingFunds: 300,
    },
    Debts: [
      { Name: 'Credit Card A', Balance: 3500, InterestRate: 0.199, MinPayment: 100 },
      { Name: 'Auto Loan', Balance: 12000, InterestRate: 0.049, MinPayment: 350 },
    ],
    EmergencyFundTargetMonths: 6,
  });

  const onCalculate = () => {
    calculate(budget);
  };

  const healthClass =
    result && result.HealthScore >= 80
      ? styles.healthGood
      : result && result.HealthScore >= 50
      ? styles.healthOkay
      : styles.healthPoor;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Budget Planner</h2>

      <button className={styles.button} onClick={onCalculate}>
        Calculate
      </button>

      {result && (
        <>
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <div>Income</div>
              <div className={styles.value}></div>
            </div>
            <div className={styles.summaryCard}>
              <div>Expenses</div>
              <div className={styles.value}></div>
            </div>
            <div className={styles.summaryCard}>
              <div>Surplus</div>
              <div className={result.Surplus >= 0 ? styles.surplus : styles.deficit}>
                
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div>Health Score</div>
              <div className={healthClass}>{result.HealthScore}</div>
            </div>
          </div>

          <BudgetChart data={result} />
          <DebtSummary debts={result.Debts || []} />
        </>
      )}
    </div>
  );
}
