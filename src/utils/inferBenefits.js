/**
 * Infer potential benefits based on veteran data
 * @param {Object} input - Complete veteran profile
 * @returns {Object} Categorized benefits
 */
export function inferBenefits(input) {
  const { serviceInfo, classifiedDisabilities, combinedRating } = input;
  
  const likelyEligible = [];
  const possiblyEligible = [];
  const notEligibleOrMissingEvidence = [];

  const scDisabilities = classifiedDisabilities?.serviceConnected || [];
  const pscDisabilities = classifiedDisabilities?.potentiallyServiceConnectable || [];

  // Disability compensation
  if (scDisabilities.some(d => d.rating >= 10)) {
    likelyEligible.push({
      name: 'VA Disability Compensation',
      reason: 'Veteran has service-connected disability rating of 10% or higher',
      cfrReference: '38 CFR § 3.4',
      evidenceNeeded: 'None - already established'
    });
  }

  // Health care
  if (scDisabilities.length > 0) {
    likelyEligible.push({
      name: 'VA Health Care',
      reason: 'Service-connected disability qualifies for VA health care',
      cfrReference: '38 CFR § 17.36',
      evidenceNeeded: 'Enrollment in VA health care system'
    });
  }

  // Special Monthly Compensation
  if (scDisabilities.some(d => d.rating >= 70)) {
    possiblyEligible.push({
      name: 'Special Monthly Compensation (SMC)',
      reason: 'High disability rating may qualify for SMC if condition meets criteria',
      cfrReference: '38 CFR § 3.350',
      evidenceNeeded: 'Medical evidence of loss of use, anatomical loss, or need for aid and attendance'
    });
  }

  // Vocational Rehabilitation
  if (scDisabilities.some(d => d.rating >= 20)) {
    likelyEligible.push({
      name: 'Vocational Rehabilitation & Employment (VR&E)',
      reason: 'Service-connected rating of 20% or higher qualifies for VR&E',
      cfrReference: '38 CFR § 21.40',
      evidenceNeeded: 'Application for VR&E services'
    });
  }

  // Dependent benefits
  if (scDisabilities.some(d => d.rating >= 30)) {
    likelyEligible.push({
      name: 'Dependent Benefits',
      reason: 'Rating of 30% or higher qualifies for additional compensation for dependents',
      cfrReference: '38 CFR § 3.450',
      evidenceNeeded: 'Proof of dependents (marriage certificate, birth certificates)'
    });
  }

  // Combat-related special compensation
  if (serviceInfo?.combatService === 'yes') {
    possiblyEligible.push({
      name: 'Combat-Related Special Compensation (CRSC)',
      reason: 'Combat veteran may qualify for CRSC if also receiving military retirement',
      cfrReference: '38 CFR § 3.950',
      evidenceNeeded: 'DD-214, retirement orders, medical evidence linking disability to combat'
    });
  }

  // Individual Unemployability
  if (combinedRating >= 70) {
    possiblyEligible.push({
      name: 'Total Disability Individual Unemployability (TDIU)',
      reason: 'Combined rating of 70% or higher may qualify for TDIU if unable to work',
      cfrReference: '38 CFR § 4.16',
      evidenceNeeded: 'Employment history, medical evidence of inability to maintain employment'
    });
  }

  // CHAMPVA
  if (combinedRating >= 100) {
    likelyEligible.push({
      name: 'CHAMPVA',
      reason: '100% disability rating qualifies dependents for CHAMPVA health coverage',
      cfrReference: '38 CFR § 17.270',
      evidenceNeeded: 'Dependent enrollment forms'
    });
  }

  // Presumptive claims for PSC
  if (pscDisabilities.length > 0) {
    possiblyEligible.push({
      name: 'Presumptive Service Connection Claims',
      reason: `${pscDisabilities.length} potentially service-connectable condition(s) identified`,
      cfrReference: '38 CFR § 3.307-3.309',
      evidenceNeeded: 'Service records, theater documentation, medical nexus statements'
    });
  }

  // State benefits
  possiblyEligible.push({
    name: 'State Veteran Benefits',
    reason: 'Many states offer additional benefits for disabled veterans',
    cfrReference: 'State-specific',
    evidenceNeeded: 'Varies by state - proof of residency and veteran status'
  });

  return {
    likelyEligible,
    possiblyEligible,
    notEligibleOrMissingEvidence
  };
}
