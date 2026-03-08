/**
 * federalBenefits.js - Federal VA Benefits Determination
 *
 * Evaluates eligibility for federal VA disability benefits and ancillary benefits.
 * Based on disability rating, military service, and dependents.
 * Authority: 38 U.S.C. Chapters 11-19
 */

/**
 * Evaluate federal VA benefits eligibility
 * @param {Object} onboardingResult - Veteran onboarding record
 * @returns {Array} Array of eligible federal benefits
 */
export function evaluateFederalBenefits(onboardingResult) {
  if (!onboardingResult) return [];

  const disability = onboardingResult.disability || { ratingPercent: 0 };
  const rating = Number(disability.ratingPercent || 0);
  const hasDependents = (onboardingResult.dependents || []).length > 0;
  const isP_T = disability.isPermanentAndTotal === true || rating === 100;

  const benefits = [];

  // 1. Basic Disability Compensation
  // Authority: 38 U.S.C. §1114
  if (rating >= 10) {
    benefits.push({
      name: 'VA Disability Compensation',
      code: 'DC-001',
      category: 'Disability Benefits',
      authority: '38 U.S.C. §1114',
      description: 'Monthly tax-free payment based on disability rating',
      eligible: true,
      requirements: ['Service-connected disability', `Disability rating: ${rating}%`],
      monthlyAmount: calculateMonthlyCompensation(rating, hasDependents),
      notes: 'Rates adjusted annually (January)'
    });
  }

  // 2. Dependency and Indemnity Compensation (DIC)
  // Authority: 38 U.S.C. §1311-1315
  if (isP_T && hasDependents) {
    benefits.push({
      name: 'Dependency & Indemnity Compensation (DIC)',
      code: 'DIC-001',
      category: 'Family Benefits',
      authority: '38 U.S.C. §1311',
      description: 'Monthly payment for eligible family members',
      eligible: true,
      requirements: ['100% disability rating', 'Eligible dependents'],
      monthlyAmount: calculateDICAmount(onboardingResult.dependents),
      notes: 'Survivor benefit if veteran passes away'
    });
  }

  // 3. Vocational Rehabilitation & Employment (VR&E)
  // Authority: 38 U.S.C. Chapter 31
  if (rating >= 10) {
    benefits.push({
      name: 'Vocational Rehabilitation & Employment (VR&E)',
      code: 'VRE-001',
      category: 'Employment & Training',
      authority: '38 U.S.C. Chapter 31',
      description: 'Training, education, and employment assistance',
      eligible: true,
      requirements: ['Service-connected disability', 'Need vocational guidance or training'],
      monthlyAmount: null,
      notes: 'Assistance for up to 48 months of training'
    });
  }

  // 4. Aid & Attendance (A&A)
  // Authority: 38 U.S.C. §1114(r)(2)
  if (rating >= 50) {
    benefits.push({
      name: 'Aid & Attendance (A&A)',
      code: 'AA-001',
      category: 'Ancillary Benefits',
      authority: '38 U.S.C. §1114(r)(2)',
      description: 'Increased benefit if requiring assistance with daily activities',
      eligible: rating >= 50,
      requirements: ['50% or higher disability', 'Need assistance with ADL'],
      monthlyAmount: 171,
      notes: 'Must apply; medical evidence required'
    });
  }

  // 5. Housebound Benefit
  // Authority: 38 U.S.C. §1114(s)
  if (rating >= 50) {
    benefits.push({
      name: 'Housebound Benefit',
      code: 'HB-001',
      category: 'Ancillary Benefits',
      authority: '38 U.S.C. §1114(s)',
      description: 'Increased benefit if essentially housebound',
      eligible: rating >= 50,
      requirements: ['50% or higher disability', 'Substantially confined to home'],
      monthlyAmount: 107,
      notes: 'Mutually exclusive with A&A'
    });
  }

  // 6. Special Monthly Compensation (SMC)
  // Authority: 38 U.S.C. §1114
  if (rating >= 50) {
    benefits.push({
      name: 'Special Monthly Compensation (SMC)',
      code: 'SMC-001',
      category: 'Additional Compensation',
      authority: '38 U.S.C. §1114',
      description: 'Additional payment for loss of limbs, sight, hearing, or combination conditions',
      eligible: true,
      requirements: ['50%+ disability', 'Specific loss conditions'],
      monthlyAmount: null,
      notes: 'Rates vary by condition (codes K-T)'
    });
  }

  // 7. Choice Program (CHAMPVA)
  // Authority: 38 U.S.C. §1781
  if (rating === 100 || isP_T) {
    benefits.push({
      name: 'CHAMPVA - Dependent Healthcare',
      code: 'CHAMP-001',
      category: 'Health & Medical',
      authority: '38 U.S.C. §1781',
      description: 'Health insurance coverage for family members',
      eligible: true,
      requirements: ['100% disability or P&T', 'Eligible family'],
      monthlyAmount: null,
      notes: 'Comprehensive health coverage for dependents'
    });
  }

  // 8. Education Benefits (GI Bill)
  // Authority: 38 U.S.C. Chapter 33-36
  benefits.push({
    name: 'GI Bill Education Benefits',
    code: 'GI-001',
    category: 'Education & Training',
    authority: '38 U.S.C. Chapter 33',
    description: 'Tuition, fees, and monthly stipend for education/training',
    eligible: true,
    requirements: ['Honorable discharge', 'Active duty service'],
    monthlyAmount: null,
    notes: '36 months benefit period (Post-9/11 GI Bill)'
  });

  // 9. Housing Benefits (Adaptive Housing)
  // Authority: 38 U.S.C. §2101-2108
  if (rating >= 50) {
    benefits.push({
      name: 'Adaptive Housing Grant',
      code: 'AH-001',
      category: 'Housing',
      authority: '38 U.S.C. §2101',
      description: 'Grant for home modifications (wheelchair access, etc.)',
      eligible: true,
      requirements: ['50%+ disability', 'Specific mobility limitations'],
      monthlyAmount: null,
      notes: 'Up to $18,000 for home modifications'
    });
  }

  // 10. Dental Treatment
  // Authority: 38 U.S.C. §1712
  if (rating >= 0) {
    benefits.push({
      name: 'VA Dental Treatment',
      code: 'DENT-001',
      category: 'Health & Medical',
      authority: '38 U.S.C. §1712',
      description: 'Dental care for service-connected conditions',
      eligible: true,
      requirements: ['Service-connected condition affecting teeth/gums'],
      monthlyAmount: null,
      notes: 'Priority given to 100% & disabled veterans'
    });
  }

  return benefits;
}

/**
 * Calculate monthly disability compensation (basic amount)
 * Note: This is simplified; actual calculation uses 2026 rate tables
 */
function calculateMonthlyCompensation(rating, hasDependents) {
  // 2026 rates (example base rates)
  const baseRates = {
    10: 177, 20: 348, 30: 540, 40: 793,
    50: 1190, 60: 1519, 70: 1967, 80: 2277,
    90: 2552, 100: 3738
  };

  const base = baseRates[rating] || 0;
  if (hasDependents) {
    return Math.round(base * 1.15); // Approximate increase with dependents
  }
  return base;
}

/**
 * Calculate DIC amount (simplified)
 */
function calculateDICAmount(dependents) {
  if (!Array.isArray(dependents) || dependents.length === 0) return 0;
  // DIC is paid to dependents, typically $400-$1000+ depending on survivor status
  return 400 + (dependents.length * 100);
}

export default { evaluateFederalBenefits };

