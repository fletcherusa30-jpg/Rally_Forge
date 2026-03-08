import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'rallyforge_retirement_planner_v3';

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

const STEP_CONFIG = [
  {
    key: 'income',
    icon: '💼',
    title: 'Income Sources in Retirement',
    fields: [
      { name: 'socialSecurityMonthly', prompt: 'What monthly Social Security benefit do you expect?', presets: [0, 1200, 1800, 2400, 3000] },
      { name: 'socialSecurityClaimAge', prompt: 'At what age do you expect to claim Social Security?', presets: [62, 67, 70] },
      { name: 'pensionMonthly', prompt: 'What monthly employer/federal pension do you expect?', presets: [0, 1000, 2000, 3500, 5000] },
      { name: 'federalBenefitsMonthly', prompt: 'Any additional federal monthly benefits?', presets: [0, 250, 500, 1000, 1500] },
      { name: 'vaRating', prompt: 'What is your VA disability rating (%), if known?', presets: [0, 10, 30, 50, 70, 100] },
      { name: 'vaMonthlyCompensation', prompt: 'VA disability compensation per month (auto-filled when rating provided).', presets: [0, 500, 1000, 2000, 3500] },
      { name: 'partTimeIncome', prompt: 'Optional part-time or consulting income during retirement?', presets: [0, 500, 1000, 2000, 3000] }
    ]
  },
  {
    key: 'expenses',
    icon: '🧾',
    title: 'Expected Expenses by Life Stage',
    fields: [
      { name: 'coreLivingExpenses', prompt: 'Core living costs each month (housing, utilities, food, transportation)?', slider: true, min: 0, max: 12000, presets: [1500, 2500, 3500, 5000, 7000] },
      { name: 'healthcareEarly', prompt: 'Healthcare cost in early retirement (monthly)?', slider: true, min: 0, max: 3000, presets: [200, 400, 700, 1000, 1500] },
      { name: 'healthcareLate', prompt: 'Healthcare cost in late retirement (monthly)?', slider: true, min: 0, max: 5000, presets: [500, 1000, 1500, 2500, 3500] },
      { name: 'lifestyleSpending', prompt: 'Lifestyle spending (travel, hobbies, giving) per month?', slider: true, min: 0, max: 6000, presets: [300, 700, 1200, 2000, 3000] },
      { name: 'debtObligations', prompt: 'Any monthly debt obligations in retirement?', presets: [0, 200, 500, 1000, 1500] },
      { name: 'inflationRate', prompt: 'Expected long-run inflation assumption (%)?', presets: [2, 3, 4, 5] }
    ]
  },
  {
    key: 'assets',
    icon: '📈',
    title: 'Savings, Investments, and Withdrawals',
    fields: [
      { name: 'tspCivilianBalance', prompt: 'Current TSP civilian balance?', presets: [0, 100000, 250000, 500000, 1000000] },
      { name: 'tspMilitaryBalance', prompt: 'Current TSP military balance?', presets: [0, 50000, 150000, 300000, 500000] },
      { name: 'iraBalance', prompt: 'Traditional IRA/SEP/SIMPLE balance?', presets: [0, 50000, 150000, 300000, 500000] },
      { name: 'rothBalance', prompt: 'Roth IRA / Roth account balance?', presets: [0, 50000, 150000, 300000, 500000] },
      { name: 'brokerageBalance', prompt: 'Taxable brokerage account balance?', presets: [0, 50000, 150000, 300000, 500000] },
      { name: 'cashReserves', prompt: 'Cash reserves available?', presets: [0, 10000, 30000, 60000, 100000] },
      { name: 'monthlyContribution', prompt: 'How much are you saving monthly before retirement?', presets: [0, 250, 500, 1000, 2000] },
      { name: 'withdrawalRate', prompt: 'Target withdrawal rule (% of assets per year)?', presets: [3, 4, 5, 6] },
      { name: 'taxRateInRetirement', prompt: 'Estimated effective tax rate in retirement (%)?', presets: [5, 10, 15, 20] }
    ]
  },
  {
    key: 'risk',
    icon: '🛡️',
    title: 'Longevity and Risk Planning',
    fields: [
      { name: 'currentAge', prompt: 'Current age?', presets: [35, 45, 55, 60] },
      { name: 'retirementAge', prompt: 'Planned retirement age?', presets: [55, 60, 62, 65, 67] },
      { name: 'planToAge', prompt: 'Plan through what age for safety?', presets: [85, 90, 95, 100] },
      { name: 'annualReturnRate', prompt: 'Expected average annual return (%) for median case?', presets: [4, 5, 6, 7, 8] },
      { name: 'downturnShockPercent', prompt: 'Assume first-year market downturn of (%)?', presets: [10, 15, 20, 30, 40] },
      { name: 'healthcareShockMonthly', prompt: 'Potential monthly healthcare shock estimate?', presets: [250, 500, 1000, 2000, 3000] }
    ]
  },
  {
    key: 'housing',
    icon: '🏠',
    title: 'Housing and Work Transition',
    fields: [
      { name: 'housingPlan', prompt: 'Housing plan: 0=stay, 1=downsize, 2=relocate, 3=rent', presets: [0, 1, 2, 3] },
      { name: 'housingCostDelta', prompt: 'Expected monthly housing change at retirement (+/-)?', presets: [-800, -300, 0, 300, 700] },
      { name: 'bridgeYears', prompt: 'How many bridge-employment years after retirement?', presets: [0, 1, 2, 3, 5] },
      { name: 'bridgeIncomeMonthly', prompt: 'Expected monthly bridge work income?', presets: [0, 500, 1000, 2000, 3000] },
      { name: 'medicareGapMonthly', prompt: 'Monthly health coverage cost before Medicare eligibility?', presets: [0, 300, 600, 900, 1200] }
    ]
  },
  {
    key: 'estate',
    icon: '📜',
    title: 'Estate, Legacy, and Review Cycle',
    fields: [
      { name: 'estateWill', prompt: 'Will/trust readiness: 0=none, 1=partial, 2=complete', presets: [0, 1, 2] },
      { name: 'beneficiariesUpdated', prompt: 'Beneficiary designations: 0=no, 1=some, 2=all updated', presets: [0, 1, 2] },
      { name: 'poaReady', prompt: 'Power of attorney and directives readiness: 0=no, 1=partial, 2=complete', presets: [0, 1, 2] },
      { name: 'reviewFrequencyMonths', prompt: 'How often will you review this plan (months)?', presets: [3, 6, 12] }
    ]
  }
];

const SAFE_ESTIMATES = {
  socialSecurityMonthly: 1800,
  socialSecurityClaimAge: 67,
  pensionMonthly: 1500,
  federalBenefitsMonthly: 300,
  vaRating: 0,
  vaMonthlyCompensation: 1000,
  partTimeIncome: 500,
  coreLivingExpenses: 3500,
  healthcareEarly: 500,
  healthcareLate: 1500,
  lifestyleSpending: 900,
  debtObligations: 300,
  inflationRate: 3,
  tspCivilianBalance: 150000,
  tspMilitaryBalance: 50000,
  iraBalance: 100000,
  rothBalance: 70000,
  brokerageBalance: 80000,
  cashReserves: 25000,
  monthlyContribution: 500,
  withdrawalRate: 4,
  taxRateInRetirement: 10,
  currentAge: 45,
  retirementAge: 62,
  planToAge: 95,
  annualReturnRate: 6,
  downturnShockPercent: 25,
  healthcareShockMonthly: 1000,
  housingPlan: 0,
  housingCostDelta: 0,
  bridgeYears: 1,
  bridgeIncomeMonthly: 1000,
  medicareGapMonthly: 600,
  estateWill: 1,
  beneficiariesUpdated: 1,
  poaReady: 1,
  reviewFrequencyMonths: 12
};

function parseNumber(value) {
  return parseFloat(value || 0);
}

function toMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

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

export function RetirementPlanner() {
  const [formData, setFormData] = useState({
    currentAge: '',
    retirementAge: '',
    yearsOfFederalService: '',
    high3Salary: '',
    tspCivilianBalance: '',
    tspMilitaryBalance: '',
    tspEmployeePercent: '',
    tspAgencyAutoPercent: '1',
    tspAgencyMatchPercent: '5',
    brokerageBalance: '',
    brokerageMonthlyContribution: '',
    vaMonthlyCompensation: '',
    crscMonthlyCompensation: '',
    annualReturnRate: '6',
    estimatedMonthlyExpenses: '',
    socialSecurityMonthly: '',
    socialSecurityClaimAge: '67',
    pensionMonthly: '',
    pensionColaRate: '2',
    federalBenefitsMonthly: '',
    partTimeIncome: '',
    rentalIncome: '',
    annuityIncome: '',
    iraBalance: '',
    rothBalance: '',
    cashReserves: '',
    monthlyContribution: '',
    withdrawalRate: '4',
    taxRateInRetirement: '10',
    coreLivingExpenses: '',
    healthcareEarly: '',
    healthcareLate: '',
    lifestyleSpending: '',
    debtObligations: '',
    inflationRate: '3',
    planToAge: '95',
    downturnShockPercent: '25',
    healthcareShockMonthly: '1000',
    housingPlan: '0',
    housingCostDelta: '0',
    bridgeYears: '0',
    bridgeIncomeMonthly: '',
    medicareGapMonthly: '',
    estateWill: '0',
    beneficiariesUpdated: '0',
    poaReady: '0',
    reviewFrequencyMonths: '12',
    vaRating: '0'
  });

  const [result, setResult] = useState(null);
  const [legacyResult, setLegacyResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('guided');
  const [activeStep, setActiveStep] = useState(0);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [manualEntry, setManualEntry] = useState({});
  const [estimatedFields, setEstimatedFields] = useState({});
  const [showReview, setShowReview] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

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
    const rating = Number(formData.vaRating || 0);
    if (!Number.isFinite(rating) || rating <= 0) return;

    const nearest = Object.keys(VA_RATING_TABLE)
      .map(Number)
      .sort((a, b) => Math.abs(a - rating) - Math.abs(b - rating))[0];

    if (nearest !== undefined) {
      setFormData(prev => ({ ...prev, vaMonthlyCompensation: String(VA_RATING_TABLE[nearest]) }));
      setEstimatedFields(prev => ({ ...prev, vaMonthlyCompensation: 'auto-from-rating' }));
    }
  }, [formData.vaRating]);

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

  const applyTypicalValues = () => {
    setValue('socialSecurityMonthly', 1800, 'typical');
    setValue('coreLivingExpenses', 3500, 'typical');
    setValue('healthcareEarly', 500, 'typical');
    setValue('healthcareLate', 1500, 'typical');
  };

  const categorySummary = (step) => {
    const total = step.fields.reduce((sum, field) => sum + parseNumber(formData[field.name]), 0);
    const completed = step.fields.filter(field => parseNumber(formData[field.name]) !== 0 || estimatedFields[field.name]).length;
    return { total, completed, totalItems: step.fields.length };
  };

  const calculateRetirement = () => {
    const currentAge = parseNumber(formData.currentAge);
    const retirementAge = parseNumber(formData.retirementAge);
    const planToAge = Math.max(parseNumber(formData.planToAge), retirementAge || 0);
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);

    const inflationRate = parseNumber(formData.inflationRate);
    const annualReturnRate = parseNumber(formData.annualReturnRate);
    const withdrawalRate = parseNumber(formData.withdrawalRate);
    const taxRate = parseNumber(formData.taxRateInRetirement) / 100;

    const totalPortfolioNow =
      parseNumber(formData.tspCivilianBalance) +
      parseNumber(formData.tspMilitaryBalance) +
      parseNumber(formData.iraBalance) +
      parseNumber(formData.rothBalance) +
      parseNumber(formData.brokerageBalance) +
      parseNumber(formData.cashReserves);

    const monthlyContribution = parseNumber(formData.monthlyContribution) + parseNumber(formData.brokerageMonthlyContribution);

    const scenarioRates = {
      conservative: Math.max(0, annualReturnRate - 2.5),
      median: annualReturnRate,
      aggressive: annualReturnRate + 2.5
    };

    const scenarioPortfolio = {
      conservative: futureValue(totalPortfolioNow, monthlyContribution, scenarioRates.conservative, yearsToRetirement),
      median: futureValue(totalPortfolioNow, monthlyContribution, scenarioRates.median, yearsToRetirement),
      aggressive: futureValue(totalPortfolioNow, monthlyContribution, scenarioRates.aggressive, yearsToRetirement)
    };

    const socialSecurityAtRetirement = retirementAge >= parseNumber(formData.socialSecurityClaimAge) ? parseNumber(formData.socialSecurityMonthly) : 0;
    const pensionAtRetirement = parseNumber(formData.pensionMonthly) * Math.pow(1 + parseNumber(formData.pensionColaRate) / 100, yearsToRetirement);
    const guaranteedIncomeMonthly =
      socialSecurityAtRetirement +
      pensionAtRetirement +
      parseNumber(formData.federalBenefitsMonthly) +
      parseNumber(formData.vaMonthlyCompensation) +
      parseNumber(formData.crscMonthlyCompensation) +
      parseNumber(formData.rentalIncome) +
      parseNumber(formData.annuityIncome);

    const bridgeIncomeMonthly = parseNumber(formData.bridgeIncomeMonthly) || parseNumber(formData.partTimeIncome);

    const housingDelta = parseNumber(formData.housingCostDelta);
    const core = parseNumber(formData.coreLivingExpenses);
    const debt = parseNumber(formData.debtObligations);
    const lifestyle = parseNumber(formData.lifestyleSpending);

    const stageExpenses = {
      early: core + parseNumber(formData.healthcareEarly) + lifestyle + debt + housingDelta + parseNumber(formData.medicareGapMonthly),
      mid: core * 1.03 + parseNumber(formData.healthcareEarly) * 1.2 + lifestyle * 0.8 + debt * 0.5 + housingDelta,
      late: core * 0.95 + parseNumber(formData.healthcareLate) + lifestyle * 0.6 + debt * 0.2 + housingDelta
    };

    const inflate = (value) => value * Math.pow(1 + inflationRate / 100, yearsToRetirement);
    const stageExpensesAtRetirement = {
      early: inflate(stageExpenses.early),
      mid: inflate(stageExpenses.mid),
      late: inflate(stageExpenses.late)
    };

    const grossIncomeAtRetirement = guaranteedIncomeMonthly + bridgeIncomeMonthly;
    const netIncomeAtRetirement = grossIncomeAtRetirement * (1 - taxRate);

    const monthlyGapEarly = Math.max(0, stageExpensesAtRetirement.early - netIncomeAtRetirement);
    const monthlyGapMid = Math.max(0, stageExpensesAtRetirement.mid - guaranteedIncomeMonthly * (1 - taxRate));
    const monthlyGapLate = Math.max(0, stageExpensesAtRetirement.late - guaranteedIncomeMonthly * (1 - taxRate));

    const medianPortfolio = scenarioPortfolio.median;
    const sustainableMonthlyWithdrawal = medianPortfolio * (withdrawalRate / 100) / 12;
    const requiredMonthlyWithdrawal = monthlyGapEarly;

    const stressPortfolio = medianPortfolio * (1 - parseNumber(formData.downturnShockPercent) / 100);
    const stressRequired = monthlyGapEarly + parseNumber(formData.healthcareShockMonthly);
    const stressCoverageYears = stressRequired > 0 ? stressPortfolio / (stressRequired * 12) : 99;

    const planHorizonYears = Math.max(1, planToAge - retirementAge);
    const averageGap = (monthlyGapEarly * 0.4) + (monthlyGapMid * 0.35) + (monthlyGapLate * 0.25);
    const longevityFundingYears = averageGap > 0 ? medianPortfolio / (averageGap * 12) : 99;

    const retirementAgeOptions = [
      Math.max(currentAge + 1, retirementAge - 3),
      retirementAge,
      retirementAge + 3
    ];

    const ageTradeoffs = retirementAgeOptions.map((age) => {
      const years = Math.max(0, age - currentAge);
      const projected = futureValue(totalPortfolioNow, monthlyContribution, annualReturnRate, years);
      const social = age >= parseNumber(formData.socialSecurityClaimAge) ? parseNumber(formData.socialSecurityMonthly) : 0;
      const monthlyIncome = social + parseNumber(formData.pensionMonthly) + parseNumber(formData.vaMonthlyCompensation) + parseNumber(formData.federalBenefitsMonthly);
      const earlyExpense = (core + parseNumber(formData.healthcareEarly) + lifestyle + debt + housingDelta) * Math.pow(1 + inflationRate / 100, years);
      const gap = Math.max(0, earlyExpense - (monthlyIncome * (1 - taxRate)));
      const cover = gap <= 0 ? 999 : projected / (gap * 12);

      return {
        retirementAge: age,
        projectedAssets: projected,
        monthlyGap: gap,
        fundedYears: cover
      };
    });

    const estateScore =
      parseNumber(formData.estateWill) * 34 +
      parseNumber(formData.beneficiariesUpdated) * 33 +
      parseNumber(formData.poaReady) * 33;

    let readinessScore = 100;
    if (requiredMonthlyWithdrawal > sustainableMonthlyWithdrawal) readinessScore -= 30;
    if (longevityFundingYears < planHorizonYears) readinessScore -= 25;
    if (stressCoverageYears < 10) readinessScore -= 20;
    if (estateScore < 150) readinessScore -= 10;
    if (parseNumber(formData.reviewFrequencyMonths) > 12) readinessScore -= 5;
    readinessScore = Math.max(0, Math.min(100, Math.round(readinessScore)));

    const recommendations = [];
    if (requiredMonthlyWithdrawal > sustainableMonthlyWithdrawal) recommendations.push('Planned withdrawal need exceeds your selected withdrawal strategy. Reduce expenses, delay retirement, or increase contributions.');
    if (longevityFundingYears < planHorizonYears) recommendations.push(`Assets may not cover your full horizon to age ${planToAge}. Consider later retirement or lower spending targets.`);
    if (stressCoverageYears < 10) recommendations.push('Stress test is weak under downturn + healthcare shock; raise reserves or reduce fixed obligations.');
    if (estateScore < 150) recommendations.push('Estate readiness is incomplete. Finalize will/trust, beneficiaries, and POA/directives.');
    if (parseNumber(formData.reviewFrequencyMonths) > 12) recommendations.push('Set a tighter annual review cadence. Reassess after major life events or policy changes.');

    if (recommendations.length === 0) {
      recommendations.push('Your current plan is resilient across baseline and stress scenarios. Keep annual reviews and policy checks in place.');
    }

    const monitoringCycle = [
      `Review every ${parseNumber(formData.reviewFrequencyMonths)} months.`,
      'Re-run plan after major life events (health, marital, inheritance, relocation).',
      'Adjust withdrawals and allocation after market drawdowns or inflation spikes.',
      'Track policy updates for Social Security, Medicare, and tax law changes.'
    ];

    return {
      yearsToRetirement,
      scenarioPortfolio,
      totalPortfolioNow,
      guaranteedIncomeMonthly,
      netIncomeAtRetirement,
      stageExpensesAtRetirement,
      monthlyGapEarly,
      monthlyGapMid,
      monthlyGapLate,
      sustainableMonthlyWithdrawal,
      requiredMonthlyWithdrawal,
      longevityFundingYears,
      planHorizonYears,
      stressCoverageYears,
      ageTradeoffs,
      estateScore,
      readinessScore,
      recommendations,
      monitoringCycle
    };
  };

  const running = useMemo(() => calculateRetirement(), [formData]);

  const saveRetirementPlanToFile = () => {
    const dataToSave = {
      savedAt: new Date().toISOString(),
      formData: formData,
      calculations: {
        yearsToRetirement: running.yearsToRetirement,
        scenarioPortfolio: running.scenarioPortfolio,
        totalPortfolioNow: running.totalPortfolioNow,
        guaranteedIncomeMonthly: running.guaranteedIncomeMonthly,
        netIncomeAtRetirement: running.netIncomeAtRetirement,
        stageExpensesAtRetirement: running.stageExpensesAtRetirement,
        monthlyGapEarly: running.monthlyGapEarly,
        monthlyGapMid: running.monthlyGapMid,
        monthlyGapLate: running.monthlyGapLate,
        sustainableMonthlyWithdrawal: running.sustainableMonthlyWithdrawal,
        requiredMonthlyWithdrawal: running.requiredMonthlyWithdrawal,
        longevityFundingYears: running.longevityFundingYears,
        planHorizonYears: running.planHorizonYears,
        stressCoverageYears: running.stressCoverageYears,
        ageTradeoffs: running.ageTradeoffs,
        estateScore: running.estateScore,
        readinessScore: running.readinessScore,
        recommendations: running.recommendations,
        monitoringCycle: running.monitoringCycle
      }
    };
    
    const json = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `retirement-plan-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleGuidedSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setResult(calculateRetirement());
      saveProgress();
    } catch (err) {
      setError(err.message || 'Failed to analyze retirement plan');
    } finally {
      setLoading(false);
    }
  };

  const handleClassicApiSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {};
      const legacyKeys = [
        'currentAge', 'retirementAge', 'yearsOfFederalService', 'high3Salary', 'tspCivilianBalance', 'tspMilitaryBalance',
        'tspEmployeePercent', 'tspAgencyAutoPercent', 'tspAgencyMatchPercent', 'brokerageBalance', 'brokerageMonthlyContribution',
        'vaMonthlyCompensation', 'crscMonthlyCompensation', 'annualReturnRate', 'estimatedMonthlyExpenses'
      ];

      legacyKeys.forEach((key) => {
        const value = formData[key];
        payload[key] = value === '' ? 0 : parseFloat(value);
      });

      const response = await fetch('/api/financial/retirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to calculate retirement');

      const data = await response.json();
      setLegacyResult(data.data);
    } catch (err) {
      setError(err.message || 'Failed to analyze retirement plan');
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
      const priorStep = activeStep - 1;
      setActiveStep(priorStep);
      setActiveFieldIndex(STEP_CONFIG[priorStep].fields.length - 1);
    }
  };

  const nextQuestion = () => {
    const maxIndex = STEP_CONFIG[activeStep].fields.length - 1;
    if (activeFieldIndex < maxIndex) {
      setActiveFieldIndex(prev => prev + 1);
      return;
    }

    nextStep();
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

  const activeStepConfig = STEP_CONFIG[activeStep];
  const activeField = activeStepConfig.fields[activeFieldIndex];

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

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" style={actionButton} onClick={() => setManualEntry(prev => ({ ...prev, [field.name]: !prev[field.name] }))}>
            Enter manually
          </button>
        </div>

        {manualEntry[field.name] && (
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
          <button type="button" style={actionButton} onClick={() => skipField(field.name)}>Skip for now</button>
        </div>
      </div>
    );
  };

  return (
    <div ref={topRef} style={{ color: baseText }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...actionButton, backgroundColor: mode === 'guided' ? '#1d4ed8' : cardBg }} onClick={() => setMode('guided')}>
            Guided Mode
          </button>
          <button type="button" style={{ ...actionButton, backgroundColor: mode === 'classic' ? '#1d4ed8' : cardBg }} onClick={() => setMode('classic')}>
            Classic (API)
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" style={actionButton} onClick={() => setHighContrast(prev => !prev)}>
            {highContrast ? 'Standard Contrast' : 'High Contrast'}
          </button>
          <button type="button" style={{ ...actionButton, backgroundColor: '#14b8a6', color: '#0f172a' }} onClick={saveRetirementPlanToFile}>
            💾 Save Plan
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: subText, marginBottom: '0.4rem' }}>
          Projected portfolio at retirement (median): <strong style={{ color: '#3b82f6' }}>{toMoney(running.scenarioPortfolio.median)}</strong>
        </p>
        <p style={{ color: subText, marginBottom: '0.4rem' }}>
          Monthly income at retirement: <strong style={{ color: '#10b981' }}>{toMoney(running.netIncomeAtRetirement)}</strong>
        </p>
        <p style={{ color: running.monthlyGapEarly <= 0 ? '#10b981' : running.monthlyGapEarly <= 500 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
          {running.monthlyGapEarly <= 0 ? 'Green: Covered in early retirement' : running.monthlyGapEarly <= 500 ? 'Yellow: Small gap' : 'Red: Funding gap'} · Early-stage gap {toMoney(running.monthlyGapEarly)}
        </p>
      </div>

      {mode === 'guided' && (
        <form onSubmit={handleGuidedSubmit}>
          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#60a5fa', fontWeight: 600, marginBottom: '0.35rem' }}>Step {activeStep + 1} of {STEP_CONFIG.length}: {activeStepConfig.title}</p>
            <p style={{ color: subText, marginBottom: '0.6rem' }}>One question at a time. We’ll build your full retirement roadmap without overload.</p>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {STEP_CONFIG.map((step, index) => {
                const summary = categorySummary(step);
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => { setActiveStep(index); setActiveFieldIndex(0); }}
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
              <button type="button" style={actionButton} onClick={saveProgress}>Save and continue later</button>
              <button type="button" style={actionButton} onClick={applyTypicalValues}>Use typical values</button>
              <button type="button" style={{ ...actionButton, backgroundColor: '#1d4ed8' }} onClick={nextQuestion}>Next</button>
            </div>
          </div>

          {showReview && (
            <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>✅ Final Review & Confirm</h3>
              <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '0.75rem' }}>
                {STEP_CONFIG.map((step, idx) => {
                  const summary = categorySummary(step);
                  return (
                    <div key={step.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: cardBg, padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                      <span>{step.icon} {step.title}: {toMoney(summary.total)}</span>
                      <button type="button" style={actionButton} onClick={() => { setShowReview(false); setActiveStep(idx); setActiveFieldIndex(0); }}>Edit</button>
                    </div>
                  );
                })}
              </div>
              <p style={{ color: running.monthlyGapEarly <= 0 ? '#10b981' : '#ef4444', fontWeight: 700, marginBottom: '0.75rem' }}>
                Early retirement income gap: {toMoney(running.monthlyGapEarly)}
              </p>
              <button type="submit" style={{ ...actionButton, backgroundColor: '#1d4ed8', width: '100%', padding: '0.75rem' }} disabled={loading}>
                {loading ? 'Analyzing Retirement Plan...' : '📊 Analyze Retirement Plan'}
              </button>
            </div>
          )}
        </form>
      )}

      {mode === 'classic' && (
        <form onSubmit={handleClassicApiSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Classic API calculator (legacy compatibility)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
              {[
                'currentAge', 'retirementAge', 'yearsOfFederalService', 'high3Salary', 'tspCivilianBalance', 'tspMilitaryBalance',
                'tspEmployeePercent', 'tspAgencyAutoPercent', 'tspAgencyMatchPercent', 'brokerageBalance', 'brokerageMonthlyContribution',
                'vaMonthlyCompensation', 'crscMonthlyCompensation', 'annualReturnRate', 'estimatedMonthlyExpenses'
              ].map((field) => (
                <div key={field}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', color: subText }}>{field}</label>
                  <input type="number" name={field} value={formData[field]} onChange={handleChange} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" style={actionButton} onClick={saveProgress}>Save and continue later</button>
              <button type="submit" style={{ ...actionButton, backgroundColor: '#1d4ed8' }} disabled={loading}>
                {loading ? 'Calculating...' : 'Calculate Retirement Plan'}
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
            <p style={{ color: subText }}>Readiness score</p>
            <p style={{ color: result.readinessScore >= 70 ? '#10b981' : result.readinessScore >= 40 ? '#f59e0b' : '#ef4444', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              {result.readinessScore}%
            </p>
            <p style={{ color: subText }}>Sustainable withdrawal: <strong style={{ color: '#10b981' }}>{toMoney(result.sustainableMonthlyWithdrawal)}</strong></p>
            <p style={{ color: subText }}>Required early-stage withdrawal: <strong style={{ color: '#ef4444' }}>{toMoney(result.requiredMonthlyWithdrawal)}</strong></p>
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText, marginBottom: '0.45rem' }}>Scenario portfolios at retirement</p>
            <p style={{ color: baseText }}>Conservative: {toMoney(result.scenarioPortfolio.conservative)}</p>
            <p style={{ color: baseText }}>Median: {toMoney(result.scenarioPortfolio.median)}</p>
            <p style={{ color: baseText }}>Aggressive: {toMoney(result.scenarioPortfolio.aggressive)}</p>
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText, marginBottom: '0.45rem' }}>Life-stage expense model at retirement</p>
            <p style={{ color: baseText }}>Early active years: {toMoney(result.stageExpensesAtRetirement.early)}</p>
            <p style={{ color: baseText }}>Mid-retirement: {toMoney(result.stageExpensesAtRetirement.mid)}</p>
            <p style={{ color: baseText }}>Late-retirement healthcare phase: {toMoney(result.stageExpensesAtRetirement.late)}</p>
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText, marginBottom: '0.45rem' }}>Retirement age tradeoff model</p>
            {result.ageTradeoffs.map((item) => (
              <div key={item.retirementAge} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', padding: '0.35rem 0' }}>
                <span>Retire at {item.retirementAge}</span>
                <span>{toMoney(item.projectedAssets)} · gap {toMoney(item.monthlyGap)} · funded {item.fundedYears.toFixed(1)} yrs</span>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText, marginBottom: '0.45rem' }}>Risk and longevity stress test</p>
            <p style={{ color: baseText }}>Plan horizon: {result.planHorizonYears} years</p>
            <p style={{ color: baseText }}>Longevity coverage: {result.longevityFundingYears.toFixed(1)} years</p>
            <p style={{ color: baseText }}>Stress coverage (market + healthcare shock): {result.stressCoverageYears.toFixed(1)} years</p>
            <p style={{ color: baseText }}>Estate readiness score: {result.estateScore}</p>
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText, marginBottom: '0.45rem' }}>Recommendations</p>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {result.recommendations.map((rec, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{rec}</li>
              ))}
            </ul>
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText, marginBottom: '0.45rem' }}>Monitoring and adjustment cycle</p>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {result.monitoringCycle.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {legacyResult && mode === 'classic' && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText }}>Legacy API results</p>
            {legacyResult.monthlyFERSPension !== undefined && <p>FERS pension: {toMoney(legacyResult.monthlyFERSPension)}</p>}
            {legacyResult.totalMonthlyIncome !== undefined && <p>Total monthly income: {toMoney(legacyResult.totalMonthlyIncome)}</p>}
            {legacyResult.projectedTSPBalance !== undefined && <p>Projected TSP: {toMoney(legacyResult.projectedTSPBalance)}</p>}
            {legacyResult.readinessScore !== undefined && <p>Readiness: {legacyResult.readinessScore}%</p>}
          </div>
        </div>
      )}
    </div>
  );
}
