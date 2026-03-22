import React, { useState, useMemo } from 'react';
import { useClaimWorkspace } from '../../context/ClaimWorkspaceContext.jsx';
import { placeholders } from '../../system/placeholders/index.js';

const WIZARD_STEPS = [
  {
    id: 'burnPit',
    title: 'Burn Pit & Airborne Hazards',
    badge: 'PACT Act',
    badgeColor: '#f6b44c',
    question: 'Were you exposed to burn pits or open-air burning of waste during your service?',
    description:
      'Includes deployments to Southwest Asia after 8/2/1990, or Afghanistan, Djibouti, Syria, or Uzbekistan after 9/11/2001, where waste was commonly incinerated in open pits.',
    detailPrompt: 'Where and when were you exposed? (e.g., FOB location, country, approximate dates)',
    presumptiveConditions: [
      'Constrictive/obliterative bronchiolitis',
      'Respiratory cancers (PACT Act presumptive list)',
      'Rhinitis / sinusitis',
      'Sleep apnea',
    ],
  },
  {
    id: 'agentOrange',
    title: 'Agent Orange / Herbicide Exposure',
    badge: 'Presumptive',
    badgeColor: '#4db6ac',
    question: 'Were you potentially exposed to Agent Orange or other tactical herbicides during your service?',
    description:
      'Applies to Vietnam veterans (1/9/1962–5/7/1975), Korean DMZ service (1968–1971), Thailand RTAF bases, or those who handled/stored herbicides at any location.',
    detailPrompt: 'Where and when did you serve or handle herbicides?',
    presumptiveConditions: [
      'Ischemic heart disease',
      'Type 2 diabetes',
      'Non-Hodgkin lymphoma',
      'Prostate cancer',
      'Parkinson\'s disease',
    ],
  },
  {
    id: 'campLejeune',
    title: 'Camp Lejeune Contaminated Water',
    badge: 'PACT Act',
    badgeColor: '#f6b44c',
    question: 'Did you live or work at Camp Lejeune, NC between August 1, 1953 and December 31, 1987?',
    description:
      'Water supply at Camp Lejeune was contaminated with volatile organic compounds (VOCs) including TCE, PCE, benzene, and vinyl chloride. Veterans and family members who lived there for 30+ days may qualify.',
    detailPrompt: 'What years did you live or work at Camp Lejeune? What units or job roles applied?',
    presumptiveConditions: [
      'Bladder cancer',
      'Kidney cancer',
      'Non-Hodgkin lymphoma',
      'Adult leukemia',
      'Parkinson\'s disease',
    ],
  },
  {
    id: 'gulfWar',
    title: 'Gulf War / Southwest Asia Illness',
    badge: 'Presumptive',
    badgeColor: '#4db6ac',
    question: 'Did you serve in Southwest Asia after August 2, 1990 and experience chronic, unexplained symptoms?',
    description:
      'Gulf War Veterans who served in the Persian Gulf region, Iraq, Kuwait, Saudi Arabia, or other SW Asia locations may have chronic multisymptom illness (CMI) qualifying as a Gulf War presumptive.',
    detailPrompt: 'What countries did you serve in, and what chronic symptoms do you currently experience?',
    presumptiveConditions: [
      'Chronic multisymptom illness (CMI)',
      'Functional gastrointestinal disorders (IBS)',
      'Medically unexplained chronic fatigue',
      'Fibromyalgia',
    ],
  },
  {
    id: 'radiation',
    title: 'Radiation Exposure',
    badge: 'Radiogenic',
    badgeColor: '#a78bfa',
    question: 'Were you exposed to ionizing radiation during your military service?',
    description:
      'Includes participation in atmospheric nuclear weapons tests, occupation of Hiroshima or Nagasaki post-WWII, POW in Japan during WWII, Palomares/Thule cleanup operations, or work with radioactive materials.',
    detailPrompt: 'Describe the nature of radiation exposure (testing site, dates, type of work):',
    presumptiveConditions: [
      'Leukemia (excluding CLL)',
      'Cancer of the thyroid, breast, pharynx, esophagus',
      'Cancer of the stomach, small intestine, pancreas',
      'Multiple myeloma',
    ],
  },
  {
    id: 'asbestos',
    title: 'Asbestos & Occupational Hazards',
    badge: 'Occupational',
    badgeColor: '#64748b',
    question: 'Did your service involve work with or around asbestos-containing materials?',
    description:
      'Common in shipyard work, construction, boiler rooms, engine rooms, aircraft maintenance, insulation, and older military vehicles/buildings. Asbestos exposure is not currently presumptive but is service-connectable.',
    detailPrompt: 'Describe your job duties and locations where asbestos exposure may have occurred:',
    presumptiveConditions: [
      'Asbestosis',
      'Pleural plaques / mesothelioma',
      'Lung cancer (with smoking history)',
    ],
  },
  {
    id: 'noise',
    title: 'Noise & Acoustic Trauma',
    badge: 'High Frequency',
    badgeColor: '#f59e0b',
    question: 'Were you regularly exposed to hazardous noise levels during your service?',
    description:
      'Includes exposure to weapons fire, aircraft engines, tracked vehicles, artillery, explosions, or any environment exceeding 85 dB without adequate hearing protection.',
    detailPrompt: 'Describe your exposure: type of noise source, duration, hearing protection used (if any):',
    presumptiveConditions: [
      'Sensorineural hearing loss',
      'Tinnitus (most common VA claim)',
      'Acoustic trauma',
    ],
  },
  {
    id: 'blast',
    title: 'Blast Events & TBI',
    badge: 'Neurological',
    badgeColor: '#22c55e',
    question: 'Were you exposed to blast events (IEDs, mortars, grenades, heavy weapons fire) during service?',
    description:
      'Blast overpressure can cause traumatic brain injury (TBI) even without direct impact. Loss of consciousness, confusion, disorientation, or memory gaps after a blast may indicate TBI.',
    detailPrompt: 'Describe blast events: location, date, whether you lost consciousness or had altered awareness:',
    presumptiveConditions: [
      'Traumatic brain injury (TBI)',
      'PTSD (combat)',
      'Post-concussive syndrome',
      'Headaches / migraines (secondary to TBI)',
    ],
  },
  {
    id: 'pfas',
    title: 'PFAS / AFFF Firefighting Foam',
    badge: 'Emerging',
    badgeColor: '#06b6d4',
    question: 'Did you work at or near airfields, flight decks, or military fire training areas where AFFF was used?',
    description:
      'Aqueous Film-Forming Foam (AFFF) containing PFAS chemicals was widely used at military airfields and during firefighting training. Contamination of drinking water near these installations is well-documented.',
    detailPrompt: 'Which installations or airfields were you stationed at? What was your proximity to AFFF use?',
    presumptiveConditions: [
      'Kidney cancer',
      'Testicular cancer',
      'Thyroid disease',
      'Ulcerative colitis',
    ],
  },
];

const EMPTY_ANSWER = { response: null, details: '' };

function buildEmptyAnswers() {
  return WIZARD_STEPS.reduce((acc, step) => {
    acc[step.id] = { ...EMPTY_ANSWER };
    return acc;
  }, {});
}

function ResponseButton({ value, selected, onClick }) {
  const colors = {
    yes: { border: '#22c55e', bg: 'rgba(34,197,94,0.12)', text: '#4ade80' },
    no: { border: '#ef4444', bg: 'rgba(239,68,68,0.1)', text: '#f87171' },
    unsure: { border: '#94a3b8', bg: 'rgba(148,163,184,0.1)', text: '#cbd5e1' },
  };
  const c = colors[value];
  const labels = { yes: 'Yes', no: 'No', unsure: 'Not Sure' };

  return (
    <button
      type='button'
      onClick={onClick}
      style={{
        padding: '0.55rem 1.4rem',
        borderRadius: '999px',
        border: `1.5px solid ${selected ? c.border : 'rgba(131,169,194,0.22)'}`,
        background: selected ? c.bg : 'transparent',
        color: selected ? c.text : 'var(--rf-text-muted)',
        fontWeight: selected ? 700 : 400,
        fontSize: '0.9rem',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {labels[value]}
    </button>
  );
}

function WizardStepCard({ step, answer, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            border: `1px solid ${step.badgeColor}44`,
            color: step.badgeColor,
            background: `${step.badgeColor}14`,
          }}
        >
          {step.badge}
        </span>
      </div>

      <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--rf-text)', lineHeight: 1.45 }}>
        {step.question}
      </p>
      <p style={{ fontSize: '0.87rem', color: 'var(--rf-text-muted)', lineHeight: 1.6 }}>
        {step.description}
      </p>

      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
        {['yes', 'no', 'unsure'].map((val) => (
          <ResponseButton
            key={val}
            value={val}
            selected={answer.response === val}
            onClick={() => onChange({ ...answer, response: val })}
          />
        ))}
      </div>

      {answer.response === 'yes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--rf-text-soft)', letterSpacing: '0.06em' }}>
            {step.detailPrompt}
          </label>
          <textarea
            value={answer.details}
            onChange={(e) => onChange({ ...answer, details: e.target.value })}
            placeholder={placeholders.claimWizard.additionalDetails}
            rows={3}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--rf-border)',
              borderRadius: 'var(--rf-radius-sm)',
              color: 'var(--rf-text)',
              fontSize: '0.875rem',
              resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
          <div style={{ marginTop: '0.3rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--rf-text-soft)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>
              Associated conditions
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {step.presumptiveConditions.map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(34,197,94,0.28)',
                    color: '#86efac',
                    background: 'rgba(34,197,94,0.08)',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WizardSummary({ answers, onRestart }) {
  const flagged = WIZARD_STEPS.filter((s) => answers[s.id]?.response === 'yes');
  const unsure = WIZARD_STEPS.filter((s) => answers[s.id]?.response === 'unsure');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--rf-text)' }}>
          Exposure Profile Summary
        </h3>
        <button
          type='button'
          onClick={onRestart}
          style={{
            fontSize: '0.78rem',
            padding: '0.3rem 0.8rem',
            borderRadius: '999px',
            border: '1px solid var(--rf-border)',
            background: 'transparent',
            color: 'var(--rf-text-muted)',
            cursor: 'pointer',
          }}
        >
          Re-take Wizard
        </button>
      </div>

      {flagged.length === 0 && unsure.length === 0 && (
        <p style={{ color: 'var(--rf-text-muted)', fontSize: '0.9rem' }}>
          No exposures flagged. If your circumstances change or you recall additional details, re-take the wizard.
        </p>
      )}

      {flagged.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4ade80', fontWeight: 700 }}>
            Confirmed Exposures ({flagged.length})
          </div>
          {flagged.map((step) => (
            <div
              key={step.id}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--rf-radius-sm)',
                border: '1px solid rgba(34,197,94,0.22)',
                background: 'rgba(34,197,94,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--rf-text)' }}>{step.title}</span>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', border: `1px solid ${step.badgeColor}44`, color: step.badgeColor }}>
                  {step.badge}
                </span>
              </div>
              {answers[step.id]?.details && (
                <p style={{ fontSize: '0.82rem', color: 'var(--rf-text-muted)', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                  "{answers[step.id].details}"
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {step.presumptiveConditions.map((c) => (
                  <span
                    key={c}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(34,197,94,0.28)',
                      color: '#86efac',
                      background: 'rgba(34,197,94,0.08)',
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {unsure.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700 }}>
            Needs Review ({unsure.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {unsure.map((step) => (
              <span
                key={step.id}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(148,163,184,0.28)',
                  color: '#cbd5e1',
                  background: 'rgba(148,163,184,0.08)',
                }}
              >
                {step.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExposureScenarioWizard() {
  const { workspace, updateWorkspace } = useClaimWorkspace();

  const saved = workspace?.exposureProfile;
  const isComplete = saved?.wizardStatus === 'complete';

  const [phase, setPhase] = useState(() => (isComplete ? 'summary' : 'intro'));
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState(() =>
    isComplete && saved?.answers ? { ...buildEmptyAnswers(), ...saved.answers } : buildEmptyAnswers(),
  );

  const currentStep = WIZARD_STEPS[stepIndex];
  const totalSteps = WIZARD_STEPS.length;

  const answeredCount = useMemo(
    () => WIZARD_STEPS.filter((s) => answers[s.id]?.response !== null).length,
    [answers],
  );

  const flaggedCount = useMemo(
    () => WIZARD_STEPS.filter((s) => answers[s.id]?.response === 'yes').length,
    [answers],
  );

  const setAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const goNext = () => {
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    } else {
      // last step → complete
      const finalAnswers = { ...answers };
      updateWorkspace((current) => ({
        ...current,
        exposureProfile: {
          wizardStatus: 'complete',
          completedAt: new Date().toISOString(),
          answers: finalAnswers,
        },
      }));
      setPhase('summary');
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    } else {
      setPhase('intro');
    }
  };

  const restart = () => {
    const reset = buildEmptyAnswers();
    setAnswers(reset);
    setStepIndex(0);
    setPhase('intro');
    updateWorkspace((current) => ({
      ...current,
      exposureProfile: {
        wizardStatus: 'not-started',
        completedAt: null,
        answers: reset,
      },
    }));
  };

  const canAdvance = answers[currentStep?.id]?.response !== null;

  return (
    <article className='rf-card' style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 className='rf-card-title' style={{ marginBottom: 0 }}>Exposure Scenario Wizard</h2>
        {phase === 'steps' && (
          <span style={{ fontSize: '0.78rem', color: 'var(--rf-text-soft)' }}>
            {stepIndex + 1} / {totalSteps}
          </span>
        )}
        {phase === 'summary' && flaggedCount > 0 && (
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.6rem',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: '999px',
              color: '#4ade80',
              background: 'rgba(34,197,94,0.1)',
            }}
          >
            {flaggedCount} exposure{flaggedCount !== 1 ? 's' : ''} flagged
          </span>
        )}
      </div>

      {/* Progress bar */}
      {phase === 'steps' && (
        <div style={{ height: '4px', borderRadius: '999px', background: 'rgba(131,169,194,0.15)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, var(--rf-accent-cool), var(--rf-accent))',
              width: `${((stepIndex + 1) / totalSteps) * 100}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* ── INTRO ── */}
      {phase === 'intro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--rf-text-muted)', lineHeight: 1.65 }}>
            This wizard walks through <strong style={{ color: 'var(--rf-text)' }}>9 common military exposure scenarios</strong> to identify
            potential presumptive and service-connectable conditions you may not have considered filing for.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.5rem',
            }}
          >
            {WIZARD_STEPS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.65rem',
                  borderRadius: 'var(--rf-radius-sm)',
                  border: '1px solid var(--rf-border)',
                  color: 'var(--rf-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ color: s.badgeColor, fontWeight: 700, fontSize: '0.72rem' }}>{i + 1}</span>
                {s.title}
              </div>
            ))}
          </div>
          <div>
            <button
              type='button'
              className='btn-primary'
              onClick={() => { setPhase('steps'); setStepIndex(0); }}
            >
              Start Wizard
            </button>
          </div>
        </div>
      )}

      {/* ── STEPS ── */}
      {phase === 'steps' && currentStep && (
        <>
          <WizardStepCard
            key={currentStep.id}
            step={currentStep}
            answer={answers[currentStep.id]}
            onChange={(val) => setAnswer(currentStep.id, val)}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.25rem', borderTop: '1px solid var(--rf-border)' }}>
            <button
              type='button'
              onClick={goBack}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.85rem',
                border: '1px solid var(--rf-border)',
                borderRadius: 'var(--rf-radius-sm)',
                background: 'transparent',
                color: 'var(--rf-text-muted)',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--rf-text-soft)' }}>
                {answeredCount}/{totalSteps} answered
              </span>
              <button
                type='button'
                className='btn-primary'
                disabled={!canAdvance}
                onClick={goNext}
              >
                {stepIndex === totalSteps - 1 ? 'Finish' : 'Next →'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── SUMMARY ── */}
      {phase === 'summary' && (
        <WizardSummary answers={answers} onRestart={restart} />
      )}
    </article>
  );
}
