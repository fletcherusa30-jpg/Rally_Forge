import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'rallyforge_budget_planner_v2';
const VA_DECISION_ENTITLEMENT_KEY = 'rallyforge_va_decision_entitlement';

const STEP_CONFIG = [
  {
    key: 'income',
    icon: '💼',
    title: 'Monthly Household Income',
    fields: [
      { name: 'salary', prompt: 'About how much do you bring in each month from work?', slider: true, min: 0, max: 12000 },
      { name: 'vaRating', prompt: 'What is your VA disability rating (%)? We can estimate compensation for you.', slider: true, min: 0, max: 100 },
      { name: 'vaDisability', prompt: 'Estimated VA monthly disability compensation (auto-filled from rating if provided).', slider: true, min: 0, max: 5000 },
      { name: 'spouseIncome', prompt: 'How much does your spouse or partner contribute monthly?', slider: true, min: 0, max: 10000 },
      { name: 'sideWork', prompt: 'Any side work or part-time income per month?', slider: true, min: 0, max: 5000 },
      { name: 'stateBenefits', prompt: 'Any monthly non-retirement benefits (state aid, credits, stipends)?', slider: true, min: 0, max: 4000 }
    ]
  },
  {
    key: 'fixed',
    icon: '🏠',
    title: 'Fixed Essentials',
    fields: [
      { name: 'mortgage', prompt: 'What do you pay monthly for housing (mortgage or rent)?', slider: true, min: 0, max: 6000 },
      { name: 'utilities', prompt: 'What do utilities usually cost each month?', slider: true, min: 0, max: 1500 },
      { name: 'insurance', prompt: 'What is your monthly insurance total?', slider: true, min: 0, max: 2000 },
      { name: 'carPayment', prompt: 'What is your monthly transportation payment?', slider: true, min: 0, max: 2000 },
      { name: 'childcare', prompt: 'Any monthly childcare cost?', slider: true, min: 0, max: 3000 }
    ]
  },
  {
    key: 'variable',
    icon: '🍽️',
    title: 'Variable Essentials',
    fields: [
      { name: 'groceries', prompt: 'What do you usually spend on food each month?', slider: true, min: 0, max: 2000 },
      { name: 'fuel', prompt: 'What is your average monthly fuel/transport fuel cost?', slider: true, min: 0, max: 1000 },
      { name: 'medicalCopays', prompt: 'What do medical co-pays and out-of-pocket costs look like monthly?', slider: true, min: 0, max: 1500 },
      { name: 'householdSupplies', prompt: 'How much do household supplies run per month?', slider: true, min: 0, max: 800 }
    ]
  },
  {
    key: 'discretionary',
    icon: '🎯',
    title: 'Discretionary',
    fields: [
      { name: 'diningOut', prompt: 'How much do you spend dining out monthly?', slider: true, min: 0, max: 1200 },
      { name: 'entertainment', prompt: 'What is your monthly entertainment spend?', slider: true, min: 0, max: 1200 },
      { name: 'subscriptions', prompt: 'How much do subscriptions cost each month?', slider: true, min: 0, max: 600 },
      { name: 'hobbies', prompt: 'What do hobbies and personal activities cost monthly?', slider: true, min: 0, max: 1200 }
    ]
  },
  {
    key: 'retirement',
    icon: '🏦',
    title: 'Retirement Savings',
    fields: [
      { name: 'currentAge', prompt: 'What is your current age?', slider: true, min: 18, max: 80 },
      { name: 'retirementAge', prompt: 'At what age do you plan to retire?', slider: true, min: 45, max: 75 },
      { name: 'annualReturnRate', prompt: 'Expected average annual investment return (%)?', slider: true, min: 1, max: 12 },
      { name: 'tsp401kMonthly', prompt: 'Monthly employee contribution to TSP or 401(k)?', slider: true, min: 0, max: 3000 },
      { name: 'tspEmployerMatchMonthly', prompt: 'Estimated monthly employer match (TSP agency contribution or 401k match)?', slider: true, min: 0, max: 1500 },
      { name: 'rothIraMonthly', prompt: 'Monthly Roth IRA contribution?', slider: true, min: 0, max: 1000 },
      { name: 'tradIraMonthly', prompt: 'Monthly Traditional IRA contribution?', slider: true, min: 0, max: 1000 },
      { name: 'tsp401kBalance', prompt: 'Current TSP / 401(k) balance (enter manually)?', slider: false },
      { name: 'rothIraBalance', prompt: 'Current Roth IRA balance (enter manually)?', slider: false },
      { name: 'tradIraBalance', prompt: 'Current Traditional IRA balance (enter manually)?', slider: false }
    ]
  }
];

const SAFE_ESTIMATES = {
  salary: 3000,
  vaDisability: 1000,
  spouseIncome: 2000,
  sideWork: 300,
  stateBenefits: 150,
  mortgage: 1400,
  utilities: 250,
  insurance: 250,
  carPayment: 400,
  childcare: 300,
  groceries: 500,
  fuel: 250,
  medicalCopays: 250,
  householdSupplies: 150,
  diningOut: 250,
  entertainment: 150,
  subscriptions: 75,
  hobbies: 200,
  currentAge: 40,
  retirementAge: 62,
  annualReturnRate: 6,
  tsp401kMonthly: 500,
  tspEmployerMatchMonthly: 250,
  rothIraMonthly: 200,
  tradIraMonthly: 0,
  tsp401kBalance: 100000,
  rothIraBalance: 25000,
  tradIraBalance: 0
};

const VA_RATING_TABLE = {
  0: 0,
  10: 171,
  20: 338,
  30: 524,
  40: 755,
  50: 1075,
  60: 1361,
  70: 1716,
  80: 1995,
  90: 2241,
  100: 3738
};

const QUICK_MODE_FIELDS = [
  { key: 'income', label: 'Income', icon: '💼', map: ['salary'] },
  { key: 'housing', label: 'Housing', icon: '🏠', map: ['mortgage'] },
  { key: 'transport', label: 'Transportation', icon: '🚗', map: ['carPayment', 'fuel'] },
  { key: 'food', label: 'Food', icon: '🍽️', map: ['groceries'] },
  { key: 'medical', label: 'Medical', icon: '🩺', map: ['medicalCopays'] },
  { key: 'other', label: 'Everything Else', icon: '📦', map: ['householdSupplies', 'diningOut', 'entertainment', 'subscriptions', 'hobbies'] },
  { key: 'retirement', label: 'Retirement Savings (TSP / 401k / IRA)', icon: '🏦', map: ['tsp401kMonthly', 'rothIraMonthly', 'tradIraMonthly'] }
];

function futureValue(principal, monthlyContribution, annualRate, years) {
  const rate = annualRate / 100;
  if (years <= 0) return principal;
  const principalFV = principal * Math.pow(1 + rate, years);
  const monthlyRate = rate / 12;
  if (monthlyRate <= 0) return principalFV + monthlyContribution * 12 * years;
  const months = years * 12;
  const contributionFV = monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  return principalFV + contributionFV;
}

function parseNumber(value) {
  return parseFloat(value || 0);
}

function toMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function BudgetPlanner() {
  const [formData, setFormData] = useState({
    salary: '',
    vaRating: '',
    vaDisability: '',
    pension: '',
    socialSecurity: '',
    spouseIncome: '',
    sideWork: '',
    rentalIncome: '',
    stateBenefits: '',
    taxCredits: '',
    stipends: '',
    bonuses: '',
    overtime: '',
    seasonalWork: '',
    mortgage: '',
    utilities: '',
    insurance: '',
    carPayment: '',
    childcare: '',
    groceries: '',
    fuel: '',
    medicalCopays: '',
    householdSupplies: '',
    diningOut: '',
    entertainment: '',
    subscriptions: '',
    hobbies: '',
    creditCardDebt: '',
    creditCardRate: '',
    creditCardMinPayment: '',
    autoLoanDebt: '',
    autoLoanRate: '',
    autoLoanMinPayment: '',
    personalLoanDebt: '',
    personalLoanRate: '',
    personalLoanMinPayment: '',
    studentLoanDebt: '',
    studentLoanRate: '',
    studentLoanMinPayment: '',
    emergencyFundContribution: '',
    emergencyFundBalance: '',
    shortTermSavings: '',
    mediumTermSavings: '',
    longTermSavings: '',
    currentAge: '',
    retirementAge: '',
    annualReturnRate: '6',
    tsp401kMonthly: '',
    tspEmployerMatchMonthly: '',
    rothIraMonthly: '',
    tradIraMonthly: '',
    tsp401kBalance: '',
    rothIraBalance: '',
    tradIraBalance: ''
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vaDecisionEntitlement, setVaDecisionEntitlement] = useState(null);
  const [mode, setMode] = useState('quick');
  const [activeStep, setActiveStep] = useState(0);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [manualEntry, setManualEntry] = useState({});
  const [estimatedFields, setEstimatedFields] = useState({});
  const [showReview, setShowReview] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [quickData, setQuickData] = useState({ income: '', housing: '', transport: '', food: '', medical: '', other: '', retirement: '' });

  const topRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed?.formData) setFormData(prev => ({ ...prev, ...parsed.formData }));
      if (parsed?.estimatedFields) setEstimatedFields(parsed.estimatedFields);
      if (typeof parsed?.activeStep === 'number') setActiveStep(parsed.activeStep);
      if (typeof parsed?.activeFieldIndex === 'number') setActiveFieldIndex(parsed.activeFieldIndex);
      if (parsed?.mode) setMode(parsed.mode);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const loadVaDecisionEntitlement = () => {
      const saved = localStorage.getItem(VA_DECISION_ENTITLEMENT_KEY);
      if (!saved) {
        setVaDecisionEntitlement(null);
        return;
      }

      try {
        const parsed = JSON.parse(saved);
        setVaDecisionEntitlement(parsed);

        setFormData((prev) => {
          const next = { ...prev };
          if ((!next.vaDisability || parseNumber(next.vaDisability) === 0) && parsed?.totalMonthly > 0) {
            next.vaDisability = String(parsed.totalMonthly);
          }
          if ((!next.vaRating || parseNumber(next.vaRating) === 0) && parsed?.rating > 0) {
            next.vaRating = String(parsed.rating);
          }
          return next;
        });
      } catch {
        setVaDecisionEntitlement(null);
      }
    };

    loadVaDecisionEntitlement();
    window.addEventListener('focus', loadVaDecisionEntitlement);
    return () => window.removeEventListener('focus', loadVaDecisionEntitlement);
  }, []);

  useEffect(() => {
    const rating = Number(formData.vaRating || 0);
    if (!Number.isFinite(rating) || rating < 0) return;

    const nearest = Object.keys(VA_RATING_TABLE)
      .map(Number)
      .sort((a, b) => Math.abs(a - rating) - Math.abs(b - rating))[0];

    if (nearest !== undefined && rating > 0) {
      setFormData(prev => ({ ...prev, vaDisability: String(VA_RATING_TABLE[nearest]) }));
      setEstimatedFields(prev => ({ ...prev, vaDisability: 'auto-from-rating' }));
    }
  }, [formData.vaRating]);

  const calculateBudget = () => {
    const primaryIncome = parseNumber(formData.salary) + parseNumber(formData.vaDisability) + parseNumber(formData.pension) + parseNumber(formData.socialSecurity);
    const secondaryIncome = parseNumber(formData.spouseIncome) + parseNumber(formData.sideWork) + parseNumber(formData.rentalIncome);
    const benefitsIncome = parseNumber(formData.stateBenefits) + parseNumber(formData.taxCredits) + parseNumber(formData.stipends);
    const irregularIncome = parseNumber(formData.bonuses) + parseNumber(formData.overtime) + parseNumber(formData.seasonalWork);
    const totalIncome = primaryIncome + secondaryIncome + benefitsIncome + irregularIncome;

    const fixedExpenses = parseNumber(formData.mortgage) + parseNumber(formData.utilities) + parseNumber(formData.insurance) + parseNumber(formData.carPayment) + parseNumber(formData.childcare);
    const variableExpenses = parseNumber(formData.groceries) + parseNumber(formData.fuel) + parseNumber(formData.medicalCopays) + parseNumber(formData.householdSupplies);
    const discretionaryExpenses = parseNumber(formData.diningOut) + parseNumber(formData.entertainment) + parseNumber(formData.subscriptions) + parseNumber(formData.hobbies);
    const totalExpenses = fixedExpenses + variableExpenses + discretionaryExpenses;

    const totalDebtPayments = parseNumber(formData.creditCardMinPayment) + parseNumber(formData.autoLoanMinPayment) + parseNumber(formData.personalLoanMinPayment) + parseNumber(formData.studentLoanMinPayment);
    const retirementContributions = parseNumber(formData.tsp401kMonthly) + parseNumber(formData.tspEmployerMatchMonthly) + parseNumber(formData.rothIraMonthly) + parseNumber(formData.tradIraMonthly);
    const totalSavings = parseNumber(formData.emergencyFundContribution) + parseNumber(formData.shortTermSavings) + parseNumber(formData.mediumTermSavings) + parseNumber(formData.longTermSavings) + retirementContributions;

    const netSurplus = totalIncome - totalExpenses - totalDebtPayments - totalSavings;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;
    const debtToIncomeRatio = totalIncome > 0 ? (totalDebtPayments / totalIncome) * 100 : 0;
    const housingRatio = totalIncome > 0 ? (parseNumber(formData.mortgage) / totalIncome) * 100 : 0;
    const discretionaryRatio = totalIncome > 0 ? (discretionaryExpenses / totalIncome) * 100 : 0;

    let healthScore = 100;
    if (netSurplus < 0) healthScore -= 30;
    if (savingsRate < 10) healthScore -= 15;
    if (debtToIncomeRatio > 36) healthScore -= 20;
    if (housingRatio > 28) healthScore -= 15;
    if (discretionaryRatio > 30) healthScore -= 10;
    if (parseNumber(formData.emergencyFundBalance) < totalExpenses * 3) healthScore -= 10;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const recommendations = [];
    if (netSurplus < 0) recommendations.push('Monthly cash out is higher than cash in. Cut discretionary categories or increase recurring income to restore runway.');
    if (savingsRate < 10) recommendations.push('Monthly reserve rate is low. Aim to route 10-15% of income into emergency and goal savings.');
    if (debtToIncomeRatio > 36) recommendations.push('Debt drag is elevated versus monthly income. Prioritize the highest-interest balances first.');
    if (housingRatio > 28) recommendations.push('Housing is consuming a large share of monthly cash flow. Review refinance, relocation, or downsizing scenarios.');
    if (parseNumber(formData.emergencyFundBalance) < totalExpenses * 6) recommendations.push('Emergency reserves are below a 6-month cushion. Build a steady monthly transfer until stabilized.');
    if (discretionaryRatio > 30) recommendations.push('Optional spending is crowding out flexibility. Rebalance dining, entertainment, and subscriptions to protect monthly margin.');

    return {
      totalIncome,
      primaryIncome,
      secondaryIncome,
      benefitsIncome,
      irregularIncome,
      totalExpenses,
      fixedExpenses,
      variableExpenses,
      discretionaryExpenses,
      totalDebtPayments,
      retirementContributions,
      totalSavings,
      netSurplus,
      savingsRate,
      debtToIncomeRatio,
      housingRatio,
      discretionaryRatio,
      healthScore,
      recommendations
    };
  };

  const running = useMemo(() => calculateBudget(), [formData]);

  const quickSnapshot = useMemo(() => {
    const values = QUICK_MODE_FIELDS.map((item) => parseNumber(quickData[item.key]));
    const answeredCount = values.filter((value) => value > 0).length;
    const totalIncome = parseNumber(quickData.income);
    const essentialSpend = parseNumber(quickData.housing) + parseNumber(quickData.transport) + parseNumber(quickData.food) + parseNumber(quickData.medical);
    const flexibleSpend = parseNumber(quickData.other);
    const retirementSavings = parseNumber(quickData.retirement);
    const totalSpend = essentialSpend + flexibleSpend + retirementSavings;
    const net = totalIncome - totalSpend;
    const essentialsRatio = totalIncome > 0 ? (essentialSpend / totalIncome) * 100 : 0;
    const flexRatio = totalIncome > 0 ? (flexibleSpend / totalIncome) * 100 : 0;
    const retirementRate = totalIncome > 0 ? (retirementSavings / totalIncome) * 100 : 0;

    let snapshotScore = 100;
    if (answeredCount < QUICK_MODE_FIELDS.length) snapshotScore -= (QUICK_MODE_FIELDS.length - answeredCount) * 5;
    if (net < 0) snapshotScore -= 25;
    if (essentialsRatio > 70) snapshotScore -= 20;
    if (flexRatio > 25) snapshotScore -= 10;
    if (retirementRate < 10) snapshotScore -= 10;
    snapshotScore = Math.max(0, Math.min(100, snapshotScore));

    const actionPrompts = [];
    if (answeredCount < QUICK_MODE_FIELDS.length) actionPrompts.push('Complete all 7 answers to improve accuracy before building your full budget.');
    if (net < 0) actionPrompts.push('Snapshot shows a monthly gap. Trim flexible spend first, then review housing and transportation.');
    if (essentialsRatio > 70) actionPrompts.push('Essentials are absorbing too much income. Compare housing and transport options to recover margin.');
    if (flexRatio > 25) actionPrompts.push('Flexible spend is high relative to income. Set a temporary cap for this month and monitor weekly.');
    if (retirementRate < 10) actionPrompts.push(`Retirement savings rate is ${retirementRate.toFixed(1)}%. Route at least 15% of income to TSP/401k/IRA to build a resilient retirement fund.`);
    if (actionPrompts.length === 0) actionPrompts.push('Strong baseline. Build the full budget to dial in debt payoff and savings targets.');

    return {
      answeredCount,
      totalIncome,
      essentialSpend,
      flexibleSpend,
      retirementSavings,
      net,
      essentialsRatio,
      flexRatio,
      retirementRate,
      snapshotScore,
      actionPrompts
    };
  }, [quickData]);

  const retirementProjection = useMemo(() => {
    const currentAge = parseNumber(formData.currentAge);
    const retirementAge = parseNumber(formData.retirementAge);
    if (currentAge <= 0 || retirementAge <= currentAge) return null;

    const annualReturnRate = parseNumber(formData.annualReturnRate) || 6;
    const yearsToRetirement = retirementAge - currentAge;
    const currentPortfolio = parseNumber(formData.tsp401kBalance) + parseNumber(formData.rothIraBalance) + parseNumber(formData.tradIraBalance);
    const monthlyFromFormData = parseNumber(formData.tsp401kMonthly) + parseNumber(formData.tspEmployerMatchMonthly) + parseNumber(formData.rothIraMonthly) + parseNumber(formData.tradIraMonthly);
    const effectiveMonthly = monthlyFromFormData > 0 ? monthlyFromFormData : parseNumber(quickData.retirement);
    const projectedPortfolio = futureValue(currentPortfolio, effectiveMonthly, annualReturnRate, yearsToRetirement);
    const conservativePortfolio = futureValue(currentPortfolio, effectiveMonthly, Math.max(1, annualReturnRate - 2.5), yearsToRetirement);
    const sustainableMonthly = projectedPortfolio * 0.04 / 12;
    const income = running.totalIncome;
    const retirementSavingsRate = income > 0 ? (effectiveMonthly / income) * 100 : 0;
    const isOnTrack = retirementSavingsRate >= 15;
    const amountBehind = isOnTrack ? 0 : Math.max(0, income * 0.15 - effectiveMonthly);

    return {
      yearsToRetirement,
      currentPortfolio,
      projectedPortfolio,
      conservativePortfolio,
      effectiveMonthly,
      sustainableMonthly,
      retirementSavingsRate,
      isOnTrack,
      amountBehind
    };
  }, [formData, quickData, running.totalIncome]);

  const saveBudgetToFile = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const generatedAt = new Date();
    const dateLabel = generatedAt.toLocaleString();
    const netColor = running.netSurplus >= 0 ? [22, 163, 74] : [220, 38, 38];

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 612, 92, 'F');
    doc.setTextColor(241, 245, 249);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Rally Forge Budget Report', 40, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${dateLabel}`, 40, 64);
    doc.text('Prepared for monthly cash-flow review and action planning', 40, 79);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Executive Summary', 40, 122);

    autoTable(doc, {
      startY: 132,
      theme: 'grid',
      head: [['Metric', 'Value']],
      body: [
        ['Monthly Cash In', toMoney(running.totalIncome)],
        ['Monthly Commitments (Spend + Debt + Savings)', toMoney(running.totalExpenses + running.totalDebtPayments + running.totalSavings)],
        ['Monthly Runway', toMoney(running.netSurplus)],
        ['Cash-Flow Stability Score', `${running.healthScore}%`]
      ],
      styles: { fontSize: 10, cellPadding: 7 },
      headStyles: { fillColor: [30, 41, 59] }
    });

    const summaryTableY = doc.lastAutoTable.finalY + 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Income and Outflow Breakdown', 40, summaryTableY);

    autoTable(doc, {
      startY: summaryTableY + 10,
      theme: 'striped',
      head: [['Category', 'Monthly Amount']],
      body: [
        ['Primary Income', toMoney(running.primaryIncome)],
        ['Secondary Income', toMoney(running.secondaryIncome)],
        ['Benefits Income', toMoney(running.benefitsIncome)],
        ['Irregular Income', toMoney(running.irregularIncome)],
        ['Fixed Essential Expenses', toMoney(running.fixedExpenses)],
        ['Variable Essential Expenses', toMoney(running.variableExpenses)],
        ['Discretionary Expenses', toMoney(running.discretionaryExpenses)],
        ['Debt Payments', toMoney(running.totalDebtPayments)],
        ['Savings Contributions', toMoney(running.totalSavings)]
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [20, 184, 166] }
    });

    const ratioTableY = doc.lastAutoTable.finalY + 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Key Ratios', 40, ratioTableY);

    autoTable(doc, {
      startY: ratioTableY + 10,
      theme: 'grid',
      head: [['Ratio', 'Value']],
      body: [
        ['Savings Rate', `${running.savingsRate.toFixed(1)}%`],
        ['Debt-to-Income', `${running.debtToIncomeRatio.toFixed(1)}%`],
        ['Housing Ratio', `${running.housingRatio.toFixed(1)}%`],
        ['Discretionary Ratio', `${running.discretionaryRatio.toFixed(1)}%`]
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [30, 41, 59] }
    });

    const recommendationY = doc.lastAutoTable.finalY + 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Recommendations', 40, recommendationY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const recommendationList = running.recommendations.length > 0
      ? running.recommendations
      : ['Budget profile appears stable. Continue monthly review cadence and keep reserves on track.'];

    let currentY = recommendationY + 16;
    recommendationList.forEach((item, index) => {
      const wrapped = doc.splitTextToSize(`${index + 1}. ${item}`, 525);
      doc.text(wrapped, 48, currentY);
      currentY += (wrapped.length * 12) + 2;
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...netColor);
    doc.setLineWidth(2);
    doc.line(40, pageHeight - 56, 572, pageHeight - 56);
    doc.setTextColor(...netColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Monthly Runway: ${toMoney(running.netSurplus)}`, 40, pageHeight - 36);

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Rally Forge | Budget Planner', 460, pageHeight - 20);

    if (retirementProjection) {
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 612, 50, 'F');
      doc.setTextColor(241, 245, 249);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('🏦 Retirement Trajectory', 40, 32);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Savings Projection from Current Budget', 40, 72);

      autoTable(doc, {
        startY: 82,
        theme: 'grid',
        head: [['Retirement Metric', 'Value']],
        body: [
          ['Years to Retirement', String(retirementProjection.yearsToRetirement)],
          ['Current Portfolio (TSP + IRA)', `$${Number(retirementProjection.currentPortfolio).toLocaleString('en-US', { maximumFractionDigits: 0 })}`],
          ['Monthly Contributions (Employee + Match)', toMoney(retirementProjection.effectiveMonthly)],
          ['Retirement Savings Rate', `${retirementProjection.retirementSavingsRate.toFixed(1)}% of income`],
          ['Projected Portfolio — Median', `$${Number(retirementProjection.projectedPortfolio).toLocaleString('en-US', { maximumFractionDigits: 0 })}`],
          ['Projected Portfolio — Conservative', `$${Number(retirementProjection.conservativePortfolio).toLocaleString('en-US', { maximumFractionDigits: 0 })}`],
          ['Monthly Withdrawal Capacity (4% rule)', toMoney(retirementProjection.sustainableMonthly)],
          ['Readiness Status', retirementProjection.isOnTrack ? 'On Track (≥15% savings rate)' : `Below target — add ${toMoney(retirementProjection.amountBehind)}/mo to reach benchmark`]
        ],
        styles: { fontSize: 10, cellPadding: 7 },
        headStyles: { fillColor: [30, 41, 59] }
      });
    }

    const fileDate = generatedAt.toISOString().split('T')[0];
    doc.save(`budget-report-${fileDate}.pdf`);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setEstimatedFields(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const setValue = (name, value, marker) => {
    setFormData(prev => ({ ...prev, [name]: String(value) }));
    if (marker) {
      setEstimatedFields(prev => ({ ...prev, [name]: marker }));
    } else {
      setEstimatedFields(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const skipField = (name) => {
    setValue(name, 0, 'skipped');
  };

  const saveProgress = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        formData,
        estimatedFields,
        activeStep,
        activeFieldIndex,
        mode,
        updatedAt: new Date().toISOString()
      })
    );
  };

  const refreshVaDecisionEntitlement = () => {
    const saved = localStorage.getItem(VA_DECISION_ENTITLEMENT_KEY);
    if (!saved) {
      setVaDecisionEntitlement(null);
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      setVaDecisionEntitlement(parsed);
      if (parsed?.totalMonthly > 0) {
        setValue('vaDisability', parsed.totalMonthly, 'va-decision-sync');
      }
      if (parsed?.rating > 0) {
        setValue('vaRating', parsed.rating, 'va-decision-sync');
      }
    } catch {
      setVaDecisionEntitlement(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setResult(calculateBudget());
      saveProgress();
    } catch (err) {
      setError(err.message || 'Failed to analyze budget');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (activeStep < STEP_CONFIG.length - 1) {
      setActiveStep(prev => prev + 1);
      setActiveFieldIndex(0);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setShowReview(true);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const prevStep = () => {
    if (activeFieldIndex > 0) {
      setActiveFieldIndex(prev => prev - 1);
      return;
    }

    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
      const previousStep = Math.max(0, activeStep - 1);
      const maxIndex = STEP_CONFIG[previousStep].fields.length - 1;
      setActiveFieldIndex(maxIndex);
    }
  };

  const nextQuestion = () => {
    const maxIndex = STEP_CONFIG[activeStep].fields.length - 1;
    if (activeFieldIndex < maxIndex) {
      setActiveFieldIndex(prev => prev + 1);
    } else {
      nextStep();
    }
  };

  const categorySummary = (step) => {
    const total = step.fields.reduce((sum, field) => sum + parseNumber(formData[field.name]), 0);
    const completed = step.fields.filter(field => parseNumber(formData[field.name]) > 0 || estimatedFields[field.name]).length;
    return { total, completed, totalItems: step.fields.length };
  };

  const applyQuickMode = () => {
    const quickIncome = parseNumber(quickData.income);
    setValue('salary', quickIncome, 'quick-mode');

    const housing = parseNumber(quickData.housing);
    setValue('mortgage', housing, 'quick-mode');

    const transport = parseNumber(quickData.transport);
    setValue('carPayment', Math.round(transport * 0.6), 'quick-mode');
    setValue('fuel', Math.round(transport * 0.4), 'quick-mode');

    setValue('groceries', parseNumber(quickData.food), 'quick-mode');
    setValue('medicalCopays', parseNumber(quickData.medical), 'quick-mode');

    const other = parseNumber(quickData.other);
    setValue('householdSupplies', Math.round(other * 0.25), 'quick-mode');
    setValue('diningOut', Math.round(other * 0.25), 'quick-mode');
    setValue('entertainment', Math.round(other * 0.2), 'quick-mode');
    setValue('subscriptions', Math.round(other * 0.1), 'quick-mode');
    setValue('hobbies', Math.round(other * 0.2), 'quick-mode');

    const retirement = parseNumber(quickData.retirement);
    setValue('tsp401kMonthly', Math.round(retirement * 0.65), 'quick-mode');
    setValue('rothIraMonthly', Math.round(retirement * 0.35), 'quick-mode');

    setMode('guided');
    setActiveStep(0);
    setActiveFieldIndex(0);
    setShowReview(true);
    saveProgress();
  };

  const baseText = highContrast ? '#ffffff' : '#f1f5f9';
  const subText = highContrast ? '#e2e8f0' : '#94a3b8';
  const cardBg = highContrast ? '#0b1220' : '#0f172a';
  const sectionBg = highContrast ? '#111827' : '#1e293b';

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: cardBg,
    border: `1px solid ${highContrast ? '#60a5fa' : '#334155'}`,
    borderRadius: '0.5rem',
    color: baseText,
    fontSize: '1rem'
  };

  const actionButton = {
    border: '1px solid #334155',
    backgroundColor: cardBg,
    color: baseText,
    borderRadius: '0.5rem',
    padding: '0.5rem 0.65rem',
    cursor: 'pointer',
    fontSize: '0.85rem'
  };

  const fieldCard = (field) => {
    const value = parseNumber(formData[field.name]);
    const marker = estimatedFields[field.name];

    return (
      <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
        <p style={{ fontSize: '1.15rem', color: baseText, marginBottom: '0.6rem', fontWeight: 600 }}>{field.prompt}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <p style={{ color: '#60a5fa', fontSize: '1.25rem', fontWeight: 700 }}>{toMoney(value)}</p>
          {marker && (
            <span style={{ color: '#fbbf24', fontSize: '0.75rem', border: '1px solid #fbbf24', borderRadius: '999px', padding: '0.15rem 0.5rem' }}>
              {marker}
            </span>
          )}
        </div>

        {field.slider && (
          <input
            type="range"
            min={field.min}
            max={field.max}
            value={value}
            onChange={(e) => setValue(field.name, e.target.value)}
            style={{ width: '100%', marginBottom: '0.75rem' }}
            aria-label={field.prompt}
          />
        )}

        {!field.slider && (
          <input
            type="number"
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            placeholder="Enter amount (e.g. 125000)"
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
          />
        )}

        {field.slider && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button type="button" style={actionButton} onClick={() => setManualEntry(prev => ({ ...prev, [field.name]: !prev[field.name] }))}>
              Enter manually
            </button>
          </div>
        )}

        {field.slider && manualEntry[field.name] && (
          <input
            type="number"
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            placeholder="0"
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
          />
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={actionButton} onClick={() => skipField(field.name)}>
            Skip for now
          </button>
        </div>
      </div>
    );
  };

  const activeStepConfig = STEP_CONFIG[activeStep];
  const activeField = activeStepConfig.fields[activeFieldIndex];

  return (
    <div ref={topRef} style={{ color: baseText }}>
      <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.85rem 1rem', marginBottom: '0.85rem' }}>
        <p style={{ color: subText, margin: 0 }}>
          Budget mode is your monthly operations view: cash in, obligations out, debt drag, and savings targets. It intentionally avoids retirement-planning prompts.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...actionButton, backgroundColor: mode === 'quick' ? '#1d4ed8' : cardBg }} onClick={() => setMode('quick')}>
            Quick Snapshot
          </button>
          <button type="button" style={{ ...actionButton, backgroundColor: mode === 'classic' ? '#1d4ed8' : cardBg }} onClick={() => setMode('classic')}>
            Full Ledger Mode
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" style={actionButton} onClick={() => setHighContrast(prev => !prev)}>
            {highContrast ? 'Standard Contrast' : 'High Contrast'}
          </button>
          <button type="button" style={{ ...actionButton, backgroundColor: '#14b8a6', color: '#0f172a' }} onClick={saveBudgetToFile}>
            🖨️ Save Budget PDF
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: subText, marginBottom: '0.5rem' }}>Cash in this month: <strong style={{ color: '#10b981' }}>{toMoney(running.totalIncome)}</strong></p>
        <p style={{ color: subText, marginBottom: '0.5rem' }}>Cash committed this month (spend + debt + savings): <strong style={{ color: '#f59e0b' }}>{toMoney(running.totalExpenses + running.totalDebtPayments + running.totalSavings)}</strong></p>
        <p style={{ color: running.netSurplus > 0 ? '#10b981' : running.netSurplus > -200 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
          {running.netSurplus > 0 ? 'Green: Monthly runway' : running.netSurplus > -200 ? 'Yellow: Tight month' : 'Red: Monthly shortfall'} · Net {toMoney(running.netSurplus)}
        </p>
      </div>

      <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <p style={{ color: '#60a5fa', fontWeight: 700 }}>🏅 VA Disability Entitlement</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" style={actionButton} onClick={refreshVaDecisionEntitlement}>Refresh from VA Decision</button>
            <button type="button" style={actionButton} onClick={() => { window.location.href = '/va-decision'; }}>Open VA Decision</button>
          </div>
        </div>

        {!vaDecisionEntitlement && (
          <p style={{ color: subText, fontSize: '0.9rem' }}>
            No entitlement data found yet. Scan or enter your rating decision on the VA Decision page, then refresh here.
          </p>
        )}

        {vaDecisionEntitlement && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.6rem' }}>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
              <p style={{ color: subText, fontSize: '0.72rem' }}>Combined Rating</p>
              <p style={{ color: baseText, fontWeight: 700 }}>{parseNumber(vaDecisionEntitlement.rating)}%</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
              <p style={{ color: subText, fontSize: '0.72rem' }}>Total Monthly</p>
              <p style={{ color: '#10b981', fontWeight: 700 }}>{toMoney(vaDecisionEntitlement.totalMonthly)}</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
              <p style={{ color: subText, fontSize: '0.72rem' }}>SMC</p>
              <p style={{ color: baseText, fontWeight: 700 }}>{vaDecisionEntitlement.smcCode || 'None'}</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
              <p style={{ color: subText, fontSize: '0.72rem' }}>Decision Source</p>
              <p style={{ color: baseText, fontWeight: 700 }}>{vaDecisionEntitlement.source || 'Unknown'}</p>
            </div>
          </div>
        )}
      </div>

      {retirementProjection && (
        <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <p style={{ color: '#60a5fa', fontWeight: 700 }}>🏦 Retirement Trajectory</p>
            <span style={{ fontSize: '0.78rem', border: `1px solid ${retirementProjection.isOnTrack ? '#10b981' : '#f59e0b'}`, borderRadius: '999px', padding: '0.2rem 0.55rem', color: retirementProjection.isOnTrack ? '#10b981' : '#f59e0b' }}>
              {retirementProjection.isOnTrack ? '✔️ On Track (≥15% savings rate)' : `⚠️ Below 15% Target — currently ${retirementProjection.retirementSavingsRate.toFixed(1)}%`}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
              <p style={{ color: subText, fontSize: '0.72rem', marginBottom: '0.2rem' }}>Monthly to Retirement Accounts</p>
              <p style={{ color: '#10b981', fontWeight: 700 }}>{toMoney(retirementProjection.effectiveMonthly)}</p>
              <p style={{ color: subText, fontSize: '0.7rem' }}>{retirementProjection.retirementSavingsRate.toFixed(1)}% of income</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
              <p style={{ color: subText, fontSize: '0.72rem', marginBottom: '0.2rem' }}>Current Portfolio (TSP + IRA)</p>
              <p style={{ color: baseText, fontWeight: 700 }}>${Number(retirementProjection.currentPortfolio).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
              <p style={{ color: subText, fontSize: '0.72rem', marginBottom: '0.2rem' }}>Projected at Retirement (median)</p>
              <p style={{ color: '#60a5fa', fontWeight: 700 }}>${Number(retirementProjection.projectedPortfolio).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p style={{ color: subText, fontSize: '0.7rem' }}>Conservative: ${Number(retirementProjection.conservativePortfolio).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
              <p style={{ color: subText, fontSize: '0.72rem', marginBottom: '0.2rem' }}>Monthly Withdrawal Capacity (4%)</p>
              <p style={{ color: '#f59e0b', fontWeight: 700 }}>{toMoney(retirementProjection.sustainableMonthly)}</p>
              <p style={{ color: subText, fontSize: '0.7rem' }}>{retirementProjection.yearsToRetirement} years to retirement</p>
            </div>
          </div>
          {!retirementProjection.isOnTrack && retirementProjection.amountBehind > 0 && (
            <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginBottom: 0 }}>
              Add {toMoney(retirementProjection.amountBehind)}/mo to TSP or IRA to reach the 15% savings benchmark.
            </p>
          )}
        </div>
      )}

      {mode === 'quick' && (
        <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <h3 style={{ marginBottom: 0, fontSize: '1.1rem' }}>⚡ Monthly Snapshot (7 key numbers)</h3>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', border: '1px solid #334155', borderRadius: '999px', padding: '0.2rem 0.55rem', color: subText }}>
                {quickSnapshot.answeredCount}/7 answered
              </span>
              <span style={{ fontSize: '0.78rem', border: `1px solid ${quickSnapshot.snapshotScore >= 75 ? '#10b981' : quickSnapshot.snapshotScore >= 50 ? '#f59e0b' : '#ef4444'}`, borderRadius: '999px', padding: '0.2rem 0.55rem', color: quickSnapshot.snapshotScore >= 75 ? '#10b981' : quickSnapshot.snapshotScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                Snapshot score: {quickSnapshot.snapshotScore}
              </span>
            </div>
          </div>

          <p style={{ color: subText, marginBottom: '0.75rem' }}>
            Answer 7 key questions for a fast monthly + retirement picture, then build the full budget when ready.
          </p>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {QUICK_MODE_FIELDS.map(item => (
              <div key={item.key} style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.85rem' }}>
                <p style={{ fontSize: '1rem', marginBottom: '0.45rem' }}>{item.icon} {item.label}</p>
                <input
                  type="range"
                  min="0"
                  max={item.key === 'income' ? '12000' : item.key === 'retirement' ? '3000' : '4000'}
                  step="50"
                  value={parseNumber(quickData[item.key])}
                  onChange={(e) => setQuickData(prev => ({ ...prev, [item.key]: e.target.value }))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                  <span style={{ color: subText }}>{toMoney(parseNumber(quickData[item.key]))}</span>
                  <button type="button" style={actionButton} onClick={() => setQuickData(prev => ({ ...prev, [item.key]: SAFE_ESTIMATES[item.map[0]] || 0 }))}>
                    I&apos;m not sure
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '0.8rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.65rem' }}>
              <p style={{ color: subText, fontSize: '0.75rem', marginBottom: '0.2rem' }}>Income</p>
              <p style={{ color: '#10b981', fontWeight: 700 }}>{toMoney(quickSnapshot.totalIncome)}</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.65rem' }}>
              <p style={{ color: subText, fontSize: '0.75rem', marginBottom: '0.2rem' }}>Essentials</p>
              <p style={{ color: baseText, fontWeight: 700 }}>{toMoney(quickSnapshot.essentialSpend)} ({quickSnapshot.essentialsRatio.toFixed(1)}%)</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.65rem' }}>
              <p style={{ color: subText, fontSize: '0.75rem', marginBottom: '0.2rem' }}>Monthly Margin</p>
              <p style={{ color: quickSnapshot.net >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{toMoney(quickSnapshot.net)}</p>
            </div>
            <div style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.65rem' }}>
              <p style={{ color: subText, fontSize: '0.75rem', marginBottom: '0.2rem' }}>Retirement Savings Rate</p>
              <p style={{ color: quickSnapshot.retirementRate >= 15 ? '#10b981' : quickSnapshot.retirementRate >= 10 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{quickSnapshot.retirementRate.toFixed(1)}% <span style={{ fontWeight: 400, fontSize: '0.7rem' }}>({toMoney(quickSnapshot.retirementSavings)}/mo)</span></p>
            </div>
          </div>

          <div style={{ marginTop: '0.7rem', backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.7rem' }}>
            <p style={{ color: '#60a5fa', fontWeight: 700, marginBottom: '0.45rem' }}>Next best moves</p>
            <ul style={{ margin: 0, paddingLeft: '1rem', color: subText, display: 'grid', gap: '0.3rem' }}>
              {quickSnapshot.actionPrompts.slice(0, 3).map((prompt) => (
                <li key={prompt}>{prompt}</li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" style={actionButton} onClick={saveProgress}>Save</button>
            <button type="button" style={{ ...actionButton, backgroundColor: '#1d4ed8' }} onClick={applyQuickMode}>Build Full Budget From Snapshot</button>
          </div>
        </div>
      )}

      {mode === 'guided' && (
        <form onSubmit={handleSubmit}>
          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#60a5fa', fontWeight: 600, marginBottom: '0.35rem' }}>Step {activeStep + 1} of {STEP_CONFIG.length}: {activeStepConfig.title}</p>
            <p style={{ color: subText, marginBottom: '0.5rem' }}>One cash-flow decision at a time, so your monthly plan stays clear and actionable.</p>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {STEP_CONFIG.map((step, index) => {
                const summary = categorySummary(step);
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => {
                      setActiveStep(index);
                      setActiveFieldIndex(0);
                    }}
                    style={{
                      ...actionButton,
                      textAlign: 'left',
                      border: index === activeStep ? '1px solid #3b82f6' : '1px solid #334155',
                      backgroundColor: index === activeStep ? '#172554' : cardBg
                    }}
                  >
                    {step.icon} {step.title}: {toMoney(summary.total)} ({summary.completed}/{summary.totalItems} items)
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
            {fieldCard(activeField)}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" style={actionButton} onClick={prevStep}>Back</button>
              <button type="button" style={actionButton} onClick={saveProgress}>Save</button>
              <button type="button" style={{ ...actionButton, backgroundColor: '#1d4ed8' }} onClick={nextQuestion}>Next</button>
            </div>
          </div>

          {showReview && (
            <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>✅ Cash-Flow Review & Confirm</h3>
              <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '0.75rem' }}>
                {STEP_CONFIG.map((step, idx) => {
                  const summary = categorySummary(step);
                  return (
                    <div key={step.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: cardBg, padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                      <span>{step.icon} {step.title}: {toMoney(summary.total)}</span>
                      <button type="button" style={actionButton} onClick={() => { setShowReview(false); setActiveStep(idx); setActiveFieldIndex(0); }}>
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
              <p style={{ color: running.netSurplus >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, marginBottom: '0.75rem' }}>
                Monthly net position: {toMoney(running.netSurplus)}
              </p>
              <button type="submit" style={{ ...actionButton, backgroundColor: '#1d4ed8', width: '100%', padding: '0.75rem' }} disabled={loading}>
                {loading ? 'Analyzing Budget...' : '📊 Run Budget Analysis'}
              </button>
            </div>
          )}
        </form>
      )}

      {mode === 'classic' && (
        <form onSubmit={handleSubmit}>
          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Full monthly ledger inputs (backward compatible)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
              {Object.keys(formData).filter(k => k !== 'vaRating').map((field) => (
                <div key={field}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', color: subText }}>{field}</label>
                  <input type="number" name={field} value={formData[field]} onChange={handleChange} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" style={actionButton} onClick={saveProgress}>Save</button>
              <button type="submit" style={{ ...actionButton, backgroundColor: '#1d4ed8' }} disabled={loading}>
                {loading ? 'Analyzing Budget...' : 'Analyze Budget'}
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#7f1d1d', color: '#fecaca' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText }}>Monthly cash in: <strong style={{ color: '#10b981' }}>{toMoney(result.totalIncome)}</strong></p>
            <p style={{ color: subText }}>Monthly commitments (spend + debt + savings): <strong style={{ color: '#f59e0b' }}>{toMoney(result.totalExpenses + result.totalDebtPayments + result.totalSavings)}</strong></p>
            <p style={{ color: result.netSurplus >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>Monthly runway: {toMoney(result.netSurplus)}</p>
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText, marginBottom: '0.45rem' }}>Cash-Flow Stability Score</p>
            <div style={{ width: '100%', height: '0.75rem', backgroundColor: '#1e293b', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.4rem' }}>
              <div
                style={{
                  width: `${result.healthScore}%`,
                  height: '100%',
                  backgroundColor: result.healthScore >= 70 ? '#10b981' : result.healthScore >= 40 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
            <p style={{ color: baseText, fontWeight: 700 }}>{result.healthScore}%</p>
          </div>

          {result.recommendations?.length > 0 && (
            <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
              <p style={{ color: subText, marginBottom: '0.5rem' }}>Monthly action adjustments</p>
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {result.recommendations.map((rec, idx) => (
                  <li key={idx} style={{ marginBottom: '0.35rem' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
