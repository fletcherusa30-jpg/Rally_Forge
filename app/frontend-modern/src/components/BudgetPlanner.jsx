import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'rallyforge_budget_planner_v2';
const VA_DECISION_ENTITLEMENT_KEY = 'rallyforge_va_decision_entitlement';

const STEP_CONFIG = [
  {
    key: 'income',
    icon: '💼',
    title: 'Income',
    fields: [
      { name: 'salary', prompt: 'About how much do you bring in each month from work?', slider: true, min: 0, max: 12000 },
      { name: 'vaRating', prompt: 'What is your VA disability rating (%)? We can estimate compensation for you.', slider: true, min: 0, max: 100 },
      { name: 'vaDisability', prompt: 'Estimated VA monthly disability compensation (auto-filled from rating if provided).', slider: true, min: 0, max: 5000 },
      { name: 'socialSecurity', prompt: 'What do you expect from Social Security each month?', slider: true, min: 0, max: 5000 },
      { name: 'pension', prompt: 'How much pension income do you receive monthly?', slider: true, min: 0, max: 7000 },
      { name: 'spouseIncome', prompt: 'How much does your spouse or partner contribute monthly?', slider: true, min: 0, max: 10000 },
      { name: 'sideWork', prompt: 'Any side work or part-time income per month?', slider: true, min: 0, max: 5000 }
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
  }
];

const SAFE_ESTIMATES = {
  salary: 3000,
  vaDisability: 1000,
  socialSecurity: 1500,
  pension: 1000,
  spouseIncome: 2000,
  sideWork: 300,
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
  hobbies: 200
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

const NATIONAL_AVERAGES = {
  utilities: 260,
  groceries: 560,
  fuel: 240
};

const IDAHO_AVERAGES = {
  utilities: 230,
  groceries: 510,
  fuel: 220
};

const QUICK_MODE_FIELDS = [
  { key: 'income', label: 'Income', icon: '💼', map: ['salary'] },
  { key: 'housing', label: 'Housing', icon: '🏠', map: ['mortgage'] },
  { key: 'transport', label: 'Transportation', icon: '🚗', map: ['carPayment', 'fuel'] },
  { key: 'food', label: 'Food', icon: '🍽️', map: ['groceries'] },
  { key: 'medical', label: 'Medical', icon: '🩺', map: ['medicalCopays'] },
  { key: 'other', label: 'Everything Else', icon: '📦', map: ['householdSupplies', 'diningOut', 'entertainment', 'subscriptions', 'hobbies'] }
];

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
    longTermSavings: ''
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vaDecisionEntitlement, setVaDecisionEntitlement] = useState(null);
  const [mode, setMode] = useState('guided');
  const [activeStep, setActiveStep] = useState(0);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [manualEntry, setManualEntry] = useState({});
  const [estimatedFields, setEstimatedFields] = useState({});
  const [showReview, setShowReview] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [quickData, setQuickData] = useState({ income: '', housing: '', transport: '', food: '', medical: '', other: '' });

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
    const totalSavings = parseNumber(formData.emergencyFundContribution) + parseNumber(formData.shortTermSavings) + parseNumber(formData.mediumTermSavings) + parseNumber(formData.longTermSavings);

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
    if (netSurplus < 0) recommendations.push('Your expenses exceed income. Reduce discretionary spending or increase income sources.');
    if (savingsRate < 10) recommendations.push('Target at least 10-15% savings rate for stronger financial resilience.');
    if (debtToIncomeRatio > 36) recommendations.push('Debt-to-income is elevated. Prioritize high-interest debt reduction.');
    if (housingRatio > 28) recommendations.push('Housing is above target ratio; evaluate refinance, relocation, or downsizing options.');
    if (parseNumber(formData.emergencyFundBalance) < totalExpenses * 6) recommendations.push('Emergency fund is below 6 months of expenses. Build reserves steadily.');
    if (discretionaryRatio > 30) recommendations.push('Discretionary spending is high. Trim non-essential categories to improve surplus.');

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

  const saveBudgetToFile = () => {
    const dataToSave = {
      savedAt: new Date().toISOString(),
      formData: formData,
      calculations: {
        totalIncome: running.totalIncome,
        primaryIncome: running.primaryIncome,
        secondaryIncome: running.secondaryIncome,
        benefitsIncome: running.benefitsIncome,
        irregularIncome: running.irregularIncome,
        totalExpenses: running.totalExpenses,
        fixedExpenses: running.fixedExpenses,
        variableExpenses: running.variableExpenses,
        discretionaryExpenses: running.discretionaryExpenses,
        totalDebtPayments: running.totalDebtPayments,
        totalSavings: running.totalSavings,
        netSurplus: running.netSurplus,
        savingsRate: running.savingsRate,
        debtToIncomeRatio: running.debtToIncomeRatio,
        housingRatio: running.housingRatio,
        discretionaryRatio: running.discretionaryRatio,
        healthScore: running.healthScore,
        recommendations: running.recommendations
      }
    };
    
    const json = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `budget-planner-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  const applyTypicalValues = () => {
    setValue('utilities', 250, 'typical');
    setValue('groceries', 500, 'typical');
    setValue('fuel', 250, 'typical');
  };

  const applyRegionalValues = (region) => {
    const source = region === 'idaho' ? IDAHO_AVERAGES : NATIONAL_AVERAGES;
    Object.entries(source).forEach(([field, value]) => setValue(field, value, region));
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

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...actionButton, backgroundColor: mode === 'guided' ? '#1d4ed8' : cardBg }} onClick={() => setMode('guided')}>
            Guided Mode
          </button>
          <button type="button" style={{ ...actionButton, backgroundColor: mode === 'quick' ? '#1d4ed8' : cardBg }} onClick={() => setMode('quick')}>
            Quick Budget Mode
          </button>
          <button type="button" style={{ ...actionButton, backgroundColor: mode === 'classic' ? '#1d4ed8' : cardBg }} onClick={() => setMode('classic')}>
            Classic Mode
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" style={actionButton} onClick={() => setHighContrast(prev => !prev)}>
            {highContrast ? 'Standard Contrast' : 'High Contrast'}
          </button>
          <button type="button" style={{ ...actionButton, backgroundColor: '#14b8a6', color: '#0f172a' }} onClick={saveBudgetToFile}>
            💾 Save Budget
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: subText, marginBottom: '0.5rem' }}>Your monthly income so far: <strong style={{ color: '#10b981' }}>{toMoney(running.totalIncome)}</strong></p>
        <p style={{ color: subText, marginBottom: '0.5rem' }}>Your monthly expenses so far: <strong style={{ color: '#ef4444' }}>{toMoney(running.totalExpenses + running.totalDebtPayments + running.totalSavings)}</strong></p>
        <p style={{ color: running.netSurplus > 0 ? '#10b981' : running.netSurplus > -200 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
          {running.netSurplus > 0 ? 'Green: Surplus' : running.netSurplus > -200 ? 'Yellow: Caution' : 'Red: Deficit'} · Net {toMoney(running.netSurplus)}
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

      {mode === 'quick' && (
        <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>⚡ Quick Budget Mode (6 questions)</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {QUICK_MODE_FIELDS.map(item => (
              <div key={item.key} style={{ backgroundColor: cardBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.85rem' }}>
                <p style={{ fontSize: '1rem', marginBottom: '0.45rem' }}>{item.icon} {item.label}</p>
                <input
                  type="range"
                  min="0"
                  max={item.key === 'income' ? '12000' : '4000'}
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
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" style={actionButton} onClick={saveProgress}>Save and continue later</button>
            <button type="button" style={{ ...actionButton, backgroundColor: '#1d4ed8' }} onClick={applyQuickMode}>Generate full budget</button>
          </div>
        </div>
      )}

      {mode === 'guided' && (
        <form onSubmit={handleSubmit}>
          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#60a5fa', fontWeight: 600, marginBottom: '0.35rem' }}>Step {activeStep + 1} of {STEP_CONFIG.length}: {activeStepConfig.title}</p>
            <p style={{ color: subText, marginBottom: '0.5rem' }}>One question at a time for lower cognitive load.</p>

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
              <button type="button" style={actionButton} onClick={saveProgress}>Save and continue later</button>
              <button type="button" style={actionButton} onClick={applyTypicalValues}>Use typical values</button>
              <button type="button" style={actionButton} onClick={() => applyRegionalValues('idaho')}>Use Idaho averages</button>
              <button type="button" style={actionButton} onClick={() => applyRegionalValues('national')}>Use national averages</button>
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
                      <button type="button" style={actionButton} onClick={() => { setShowReview(false); setActiveStep(idx); setActiveFieldIndex(0); }}>
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
              <p style={{ color: running.netSurplus >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, marginBottom: '0.75rem' }}>
                Surplus / Deficit: {toMoney(running.netSurplus)}
              </p>
              <button type="submit" style={{ ...actionButton, backgroundColor: '#1d4ed8', width: '100%', padding: '0.75rem' }} disabled={loading}>
                {loading ? 'Analyzing Budget...' : '📊 Analyze My Budget'}
              </button>
            </div>
          )}
        </form>
      )}

      {mode === 'classic' && (
        <form onSubmit={handleSubmit}>
          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Classic detailed inputs (backward compatible)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
              {Object.keys(formData).filter(k => k !== 'vaRating').map((field) => (
                <div key={field}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', color: subText }}>{field}</label>
                  <input type="number" name={field} value={formData[field]} onChange={handleChange} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" style={actionButton} onClick={saveProgress}>Save and continue later</button>
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
            <p style={{ color: subText }}>Income: <strong style={{ color: '#10b981' }}>{toMoney(result.totalIncome)}</strong></p>
            <p style={{ color: subText }}>Expenses + Debt + Savings: <strong style={{ color: '#ef4444' }}>{toMoney(result.totalExpenses + result.totalDebtPayments + result.totalSavings)}</strong></p>
            <p style={{ color: result.netSurplus >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>Net: {toMoney(result.netSurplus)}</p>
          </div>

          <div style={{ backgroundColor: sectionBg, border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ color: subText, marginBottom: '0.45rem' }}>Financial Health Score</p>
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
              <p style={{ color: subText, marginBottom: '0.5rem' }}>Recommended adjustments</p>
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
