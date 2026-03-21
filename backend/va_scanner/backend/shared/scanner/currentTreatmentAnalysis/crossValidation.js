/**
 * Cross-check quality signals for current treatment extraction.
 */

const MED_HINTS = [
  { med: /gabapentin|pregabalin/i, expected: /neuropathy|nerve|radiculopathy|pain/i },
  { med: /sertraline|fluoxetine|venlafaxine|bupropion/i, expected: /depression|anxiety|ptsd|mood/i },
  { med: /albuterol|symbicort|fluticasone/i, expected: /asthma|copd|respiratory|wheez/i },
  { med: /metformin|insulin/i, expected: /diabetes|a1c|glucose/i },
];

function hasConditionLike(conditions, regex) {
  return (conditions || []).some((c) => regex.test(String(c?.value || '')));
}

export function runCurrentTreatmentCrossValidation(data) {
  const medicationWithoutCondition = [];
  const treatmentWithoutCondition = [];
  const followUpGaps = [];

  for (const med of data.medications || []) {
    for (const hint of MED_HINTS) {
      if (hint.med.test(String(med?.value || '')) && !hasConditionLike(data.currentConditions, hint.expected)) {
        medicationWithoutCondition.push({
          medication: med?.value || null,
          expectedConditionPattern: String(hint.expected),
          note: 'Potential missing condition context for medication.',
        });
      }
    }
  }

  if ((data.treatments || []).length > 0 && (data.currentConditions || []).length === 0) {
    treatmentWithoutCondition.push({
      note: 'Treatments detected but no explicit condition entries found.',
    });
  }

  const appointments = (data.appointments || []).filter((a) => a?.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (let i = 1; i < appointments.length; i += 1) {
    const prev = new Date(appointments[i - 1].date);
    const curr = new Date(appointments[i].date);
    const dayDiff = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
    if (Number.isFinite(dayDiff) && dayDiff > 365) {
      followUpGaps.push({
        previousDate: appointments[i - 1].date,
        currentDate: appointments[i].date,
        daysBetween: dayDiff,
        note: 'Large treatment follow-up gap detected.',
      });
    }
  }

  return {
    medicationWithoutCondition,
    treatmentWithoutCondition,
    followUpGaps,
  };
}
