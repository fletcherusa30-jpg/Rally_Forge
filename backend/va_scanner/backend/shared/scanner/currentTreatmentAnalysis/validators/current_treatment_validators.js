'use strict';

/**
 * Current Treatment Record Validators
 * Validates extracted active conditions, medications, and functional impacts
 */

class CurrentTreatmentValidators {
  constructor(config = {}) {
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.strictMode = config.strictMode !== false;
    this.medications = config.medications || {};
    this.diagnoses = config.diagnoses || {};
  }

  /**
   * Validate complete current treatment extraction output
   * @param {Object} ctrOutput - Extracted current treatment data
   * @returns {Object} {isValid: boolean, errors: Array, warnings: Array}
   */
  validateCurrentTreatmentExtraction(ctrOutput) {
    const errors = [];
    const warnings = [];

    this.logger.info('Beginning current treatment extraction validation');

    // Validate metadata
    if (!ctrOutput._metadata) {
      errors.push('Missing _metadata object');
    } else {
      const metaValidation = this.validateMetadata(ctrOutput._metadata);
      errors.push(...metaValidation.errors);
      warnings.push(...metaValidation.warnings);
    }

    // Validate active conditions
    if (ctrOutput.activeConditions && Array.isArray(ctrOutput.activeConditions)) {
      const condValidation = this.validateActiveConditions(ctrOutput.activeConditions);
      errors.push(...condValidation.errors);
      warnings.push(...condValidation.warnings);
    } else {
      errors.push('Missing activeConditions array');
    }

    // Validate current medications
    if (ctrOutput.currentMedications && Array.isArray(ctrOutput.currentMedications)) {
      const medValidation = this.validateMedications(ctrOutput.currentMedications);
      errors.push(...medValidation.errors);
      warnings.push(...medValidation.warnings);
    }

    // Validate functional impairments
    if (ctrOutput.functionalImpairments && Array.isArray(ctrOutput.functionalImpairments)) {
      const funcValidation = this.validateFunctionalImpairments(ctrOutput.functionalImpairments);
      errors.push(...funcValidation.errors);
      warnings.push(...funcValidation.warnings);
    }

    // Validate symptoms and complaints
    if (ctrOutput.symptomsComplaints && Array.isArray(ctrOutput.symptomsComplaints)) {
      const sympValidation = this.validateSymptoms(ctrOutput.symptomsComplaints);
      errors.push(...sympValidation.errors);
      warnings.push(...sympValidation.warnings);
    }

    // Validate treatment providers
    if (ctrOutput.treatingProviders && Array.isArray(ctrOutput.treatingProviders)) {
      const provValidation = this.validateTreatingProviders(ctrOutput.treatingProviders);
      errors.push(...provValidation.errors);
      warnings.push(...provValidation.warnings);
    }

    // Validate vital signs and lab data if present
    if (ctrOutput.vitalSigns) {
      const vitalValidation = this.validateVitalSigns(ctrOutput.vitalSigns);
      errors.push(...vitalValidation.errors);
      warnings.push(...vitalValidation.warnings);
    }

    const isValid = errors.length === 0;
    this.logger.info(`Current treatment validation: ${isValid ? 'PASS' : 'FAIL'}`);

    return {
      isValid: isValid,
      status: isValid ? 'PASS' : 'FAIL',
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate metadata fields
   */
  validateMetadata(metadata) {
    const errors = [];
    const warnings = [];

    if (!metadata.scannerId) {
      errors.push('Missing scannerId');
    }

    if (!metadata.extractionDate || isNaN(Date.parse(metadata.extractionDate))) {
      errors.push('Invalid extraction date');
    }

    if (!metadata.reportDate || isNaN(Date.parse(metadata.reportDate))) {
      errors.push('Invalid report date');
    }

    // Check if report is current (within last 1 year)
    if (metadata.reportDate) {
      const reportDate = new Date(metadata.reportDate);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      if (reportDate < oneYearAgo) {
        warnings.push(`Current treatment record is older than 1 year: ${metadata.reportDate}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate active conditions
   */
  validateActiveConditions(conditions) {
    const errors = [];
    const warnings = [];

    if (conditions.length === 0) {
      errors.push('No active conditions documented');
    }

    const seenConditions = new Set();

    for (const condition of conditions) {
      if (!condition.conditionName || condition.conditionName.trim().length === 0) {
        errors.push('Condition missing name');
      }

      if (!condition.diagnosisCode) {
        errors.push(`Condition missing diagnosis code: ${condition.conditionName}`);
      } else {
        // Validate ICD-10 format (ICD-9 also acceptable)
        if (!/^[A-Z0-9]{3,5}(\.[A-Z0-9]{1,2})?$/.test(condition.diagnosisCode)) {
          errors.push(`Invalid ICD code format: ${condition.diagnosisCode}`);
        }
      }

      // Check for duplicates
      const condKey = `${condition.conditionName}-${condition.diagnosisCode}`;
      if (seenConditions.has(condKey)) {
        warnings.push(`Duplicate condition: ${condition.conditionName}`);
      }
      seenConditions.add(condKey);

      // Validate status
      if (!condition.status || !['Active', 'Chronic', 'Stable', 'Unstable', 'Healing', 'Resolved'].includes(condition.status)) {
        warnings.push(`Unclear condition status: ${condition.status}`);
      }

      // Validate onset date
      if (condition.onsetDate && isNaN(Date.parse(condition.onsetDate))) {
        errors.push(`Invalid condition onset date: ${condition.onsetDate}`);
      }

      // Check for severity documentation
      if (!condition.severity || !['Mild', 'Moderate', 'Severe', 'Not Specified'].includes(condition.severity)) {
        warnings.push(`Severity not well documented: ${condition.severity}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate current medications
   */
  validateMedications(medications) {
    const errors = [];
    const warnings = [];

    if (medications.length === 0) {
      warnings.push('No current medications documented');
    }

    const seenMedications = new Set();

    for (const med of medications) {
      if (!med.medicationName || med.medicationName.trim().length === 0) {
        errors.push('Medication missing name');
      }

      // Check for duplicates
      if (seenMedications.has(med.medicationName)) {
        warnings.push(`Duplicate medication: ${med.medicationName}`);
      }
      seenMedications.add(med.medicationName);

      // Validate dosage
      if (!med.dosage || med.dosage.trim().length === 0) {
        errors.push(`Medication ${med.medicationName} missing dosage`);
      }

      // Validate frequency
      if (!med.frequency || !['Daily', 'Twice Daily', 'Three Times Daily', 'As Needed', 'Weekly', 'Monthly'].includes(med.frequency)) {
        warnings.push(`Medication ${med.medicationName} has unclear frequency: ${med.frequency}`);
      }

      // Validate route of administration
      if (!med.route || !['Oral', 'Topical', 'Injection', 'Inhaler', 'Sublingual', 'IV'].includes(med.route)) {
        errors.push(`Invalid medication route: ${med.route}`);
      }

      // Validate indication
      if (!med.indication || med.indication.trim().length === 0) {
        warnings.push(`Medication ${med.medicationName} missing indication`);
      }

      // Check for start date
      if (med.startDate && isNaN(Date.parse(med.startDate))) {
        errors.push(`Invalid medication start date: ${med.startDate}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate functional impairments
   */
  validateFunctionalImpairments(impairments) {
    const errors = [];
    const warnings = [];

    if (impairments.length === 0) {
      warnings.push('No functional impairments documented');
    }

    const validActivityCategories = [
      'Ambulation', 'ADL', 'Cognition', 'Hearing', 'Vision', 'Strength', 'Mobility',
      'Coordination', 'Endurance', 'Pain', 'Mental Function', 'Social Function'
    ];

    for (const impairment of impairments) {
      if (!impairment.activityCategory) {
        errors.push('Impairment missing activity category');
      } else if (!validActivityCategories.some(cat => impairment.activityCategory.includes(cat))) {
        warnings.push(`Unusual activity category: ${impairment.activityCategory}`);
      }

      // Validate severity
      if (!impairment.severity || !['Mild', 'Moderate', 'Severe', 'Profound'].includes(impairment.severity)) {
        warnings.push(`Unclear impairment severity: ${impairment.severity}`);
      }

      // Validate functional limitation
      if (!impairment.functionalLimitation || impairment.functionalLimitation.trim().length === 0) {
        errors.push(`Impairment in ${impairment.activityCategory} missing limitation description`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate symptoms and complaints
   */
  validateSymptoms(symptoms) {
    const errors = [];
    const warnings = [];

    if (symptoms.length === 0) {
      warnings.push('No symptoms or complaints documented');
    }

    for (const symptom of symptoms) {
      if (!symptom.symptomName || symptom.symptomName.trim().length === 0) {
        errors.push('Symptom missing name');
      }

      // Validate duration
      if (!symptom.duration || symptom.duration.trim().length === 0) {
        errors.push(`Symptom ${symptom.symptomName} missing duration`);
      }

      // Validate severity
      if (!symptom.severity || !['Mild', 'Moderate', 'Severe'].includes(symptom.severity)) {
        warnings.push(`Symptom ${symptom.symptomName} severity unclear: ${symptom.severity}`);
      }

      // Check for onset date
      if (symptom.onsetDate && isNaN(Date.parse(symptom.onsetDate))) {
        errors.push(`Invalid symptom onset date: ${symptom.onsetDate}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate treating providers
   */
  validateTreatingProviders(providers) {
    const errors = [];
    const warnings = [];

    if (providers.length === 0) {
      warnings.push('No treating providers documented');
    }

    for (const provider of providers) {
      if (!provider.providerName || provider.providerName.trim().length === 0) {
        errors.push('Provider missing name');
      }

      if (!provider.specialty) {
        errors.push('Provider missing specialty');
      }

      if (!provider.facility) {
        errors.push('Provider missing facility name');
      }

      // Validate last visit date
      if (provider.lastVisitDate && isNaN(Date.parse(provider.lastVisitDate))) {
        errors.push(`Invalid last visit date: ${provider.lastVisitDate}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate vital signs
   */
  validateVitalSigns(vitals) {
    const errors = [];
    const warnings = [];

    if (!vitals.measurementDate || isNaN(Date.parse(vitals.measurementDate))) {
      errors.push('Invalid vital signs measurement date');
    }

    // Blood Pressure validation (systolic/diastolic)
    if (vitals.bloodPressure) {
      const [systolic, diastolic] = vitals.bloodPressure.split('/').map(Number);
      if (systolic < 70 || systolic > 200 || diastolic < 40 || diastolic > 130) {
        warnings.push(`Unusual blood pressure reading: ${vitals.bloodPressure}`);
      }
    }

    // Heart rate validation (typically 60-100 for adults at rest)
    if (vitals.heartRate) {
      if (vitals.heartRate < 40 || vitals.heartRate > 120) {
        warnings.push(`Unusual heart rate: ${vitals.heartRate} bpm`);
      }
    }

    // Temperature validation (in Fahrenheit)
    if (vitals.temperature) {
      if (vitals.temperature < 95 || vitals.temperature > 104) {
        warnings.push(`Unusual temperature: ${vitals.temperature}°F`);
      }
    }

    return { errors, warnings };
  }
}

module.exports = CurrentTreatmentValidators;
