import React from 'react';
import styles from './BudgetChart.module.css';

export function BudgetChart({ data }) {
  const items = [
    { label: 'Fixed', value: data.FixedExpenses },
    { label: 'Variable', value: data.VariableExpenses },
    { label: 'Annual (Monthly)', value: data.AnnualExpensesMonthly },
    { label: 'Savings', value: data.Savings },
  ];

  const max = Math.max(...items.map(i => i.value), 1);

  return (
    <div className={styles.chartContainer}>
      {items.map(item => {
        const width = (item.value / max) * 100;
        return (
          <div key={item.label} className={styles.row}>
            <div className={styles.label}>{item.label}</div>
            <div className={styles.barOuter}>
              <div className={styles.barInner} style={{ width: ${width}% }} />
            </div>
            <div className={styles.value}></div>
          </div>
        );
      })}
    </div>
  );
}
