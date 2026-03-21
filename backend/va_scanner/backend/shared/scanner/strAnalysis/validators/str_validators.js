'use strict';

/**
 * Service Treatment Record (STR) Validators
 * Validates extracted in-service diagnoses, injuries, and exposures
 */

class STRValidators {
  constructor(config = {}) {
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.strictMode = config.strictMode !== false;
    this.medicalTerms = config.medicalTerms || {};
    this.exposures = config.exposures || {};
  }

  /**
   * Validate complete STR extraction output
   * @param {Object} strOutput - Extracted STR data
   * @returns {Object} {isValid: boolean, errors: Array, warnings: Array}
   */
  validateSTRExtraction(strOutput) {
    const errors = [];
    const warnings = [];

    this.logger.info('Beginning STR extraction validation');

    // Validate metadata
    if (!strOutput._metadata) {
      errors.push('Missing _metadata object');
    } else {
      const metaValidation = this.validateMetadata(strOutput._metadata);
      errors.push(...metaValidation.errors);
      warnings.push(...metaValidation.warnings);
    }

    // Validate in-service diagnoses
    if (strOutput.inServiceDiagnoses && Array.isArray(strOutput.inServiceDiagnoses)) {
      const diagValidation = this.validateDiagnoses(strOutput.inServiceDiagnoses);
      errors.push(...diagValidation.errors);
      warnings.push(...diagValidation.warnings);
    } else if (!strOutput.inServiceDiagnoses) {
      errors.push('Missing inServiceDiagnoses array');
    }

    // Validate service-related injuries
    if (strOutput.serviceRelatedInjuries && Array.isArray(strOutput.serviceRelatedInjuries)) {
      const injuryValidation = this.validateInjuries(strOutput.serviceRelatedInjuries);
      errors.push(...injuryValidation.errors);
      warnings.push(...injuryValidation.warnings);
    }

    // Validate service line exposures
    if (strOutput.serviceLineExposures && Array.isArray(strOutput.serviceLineExposures)) {
      const exposureValidation = this.validateExposures(strOutput.serviceLineExposures);
      errors.push(...exposureValidation.errors);
      warnings.push(...exposureValidation.warnings);
    }

    // Validate medical encounters chronology
    if (strOutput.medicalEncounters && Array.isArray(strOutput.medicalEncounters)) {
      const chronoValidation = this.validateChronology(strOutput.medicalEncounters);
      errors.push(...chronoValidation.errors);
      warnings.push(...chronoValidation.warnings);
    }

    // Validate treatment provider information
    if (strOutput.treatmentProviders && Array.isArray(strOutput.treatmentProviders)) {
      const providerValidation = this.validateProviders(strOutput.treatmentProviders);
      errors.push(...providerValidation.errors);
      warnings.push(...providerValidation.warnings);
    }

    const isValid = errors.length === 0;
    this.logger.info(`STR validation: ${isValid ? 'PASS' : 'FAIL'}`);

    return {
      isValid: isValid,
      status: isValid ? 'PASS' : 'FAIL',
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate STR metadata
   */
  validateMetadata(metadata) {
    const errors = [];
    const warnings = [];

    if (!metadata.scannerId) {
      errors.push('Missing scannerId in metadata');
    }

    if (!metadata.extractionDate || isNaN(Date.parse(metadata.extractionDate))) {
      errors.push('Invalid extraction date');
    }

    if (!metadata.documentCount || metadata.documentCount < 1) {
      warnings.push('No documents counted in STR package');
    }

    return { errors, warnings };
  }

  /**
   * Validate in-service diagnoses
   */
  validateDiagnoses(diagnoses) {
    const errors = [];
    const warnings = [];

    if (diagnoses.length === 0) {
      errors.push('No diagnoses found in STR');
    }

    const seenDiagnoses = new Set();

    for (const diagnosis of diagnoses) {
      // Check for required fields
      if (!diagnosis.diagnosisCode) {
        errors.push('Diagnosis missing ICD code');
      } else {
        // Validate ICD-9 or ICD-10 format
        if (!/^[A-Z0-9]{3,5}(\.[A-Z0-9]{1,2})?$/.test(diagnosis.diagnosisCode)) {
          errors.push(`Invalid ICD code format: ${diagnosis.diagnosisCode}`);
        }
      }

      if (!diagnosis.diagnosisDescription || diagnosis.diagnosisDescription.trim().length === 0) {
        errors.push('Diagnosis missing description');
      }

      // Check for duplicates
      const diagKey = `${diagnosis.diagnosisCode}-${diagnosis.diagnosisDescription}`;
      if (seenDiagnoses.has(diagKey)) {
        warnings.push(`Duplicate diagnosis: ${diagnosis.diagnosisCode}`);
      }
      seenDiagnoses.add(diagKey);

      // Validate encounter date
      if (diagnosis.encounterDate && isNaN(Date.parse(diagnosis.encounterDate))) {
        errors.push(`Invalid encounter date for diagnosis ${diagnosis.diagnosisCode}: ${diagnosis.encounterDate}`);
      }

      // Check for presumptive conditions
      const presumptiveConditions = ['Agent Orange', 'Radiation', 'Depleted Uranium', 'Gulf War Syndrome', 'Burn Pit'];
      if (presumptiveConditions.some(pc => diagnosis.diagnosisDescription.includes(pc))) {
        diagnosis.presumptiveIndicator = true;
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate service-related injuries
   */
  validateInjuries(injuries) {
    const errors = [];
    const warnings = [];

    if (injuries.length === 0) {
      warnings.push('No service-related injuries documented');
    }

    for (const injury of injuries) {
      if (!injury.injuryType || injury.injuryType.trim().length === 0) {
        errors.push('Injury missing type');
      }

      if (!injury.anatomicalSite) {
        errors.push(`Injury missing anatomical site: ${injury.injuryType}`);
      } else {
        // Validate anatomical site against known body parts
        const validSites = ['Head', 'Face', 'Neck', 'Chest', 'Abdomen', 'Upper Extremity', 'Lower Extremity', 'Back', 'Pelvis', 'Bilateral'];
        if (!validSites.some(site => injury.anatomicalSite.includes(site))) {
          warnings.push(`Unusual anatomical site: ${injury.anatomicalSite}`);
        }
      }

      if (injury.incidentDate && isNaN(Date.parse(injury.incidentDate))) {
        errors.push(`Invalid incident date: ${injury.incidentDate}`);
      }

      // Check for current status
      if (!injury.currentStatus || !['Healed', 'Healing', 'Chronic', 'Residual', 'Unknown'].includes(injury.currentStatus)) {
        warnings.push(`Unclear injury status: ${injury.currentStatus}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate service line exposures
   */
  validateExposures(exposures) {
    const errors = [];
    const warnings = [];

    if (exposures.length === 0) {
      warnings.push('No service line exposures documented');
    }

    const validExposureTypes = [
      'Agent Orange', 'Radiation', 'Dioxin', 'Burn Pit', 'IED', 'RPG',
      'Chemical Weapons', 'Biological', 'Heat', 'Cold', 'Altitude',
      'Noise', 'Lead', 'Asbestos', 'Welding Fumes', 'Combat'
    ];

    for (const exposure of exposures) {
      if (!exposure.exposureType) {
        errors.push('Exposure missing type');
      } else if (!validExposureTypes.includes(exposure.exposureType)) {
        warnings.push(`Unusual exposure type: ${exposure.exposureType}`);
      }

      if (!exposure.durationOfExposure || exposure.durationOfExposure.trim().length === 0) {
        errors.push(`Exposure missing duration: ${exposure.exposureType}`);
      }

      if (exposure.locationOfExposure && exposure.locationOfExposure.trim().length === 0) {
        errors.push('Exposure missing location');
      }

      // Check for documentation level
      if (!exposure.documentationLevel || !['Direct', 'Presumptive', 'Potential', 'Possible'].includes(exposure.documentationLevel)) {
        warnings.push(`Unclear exposure documentation: ${exposure.documentationLevel}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate medical encounters chronology
   */
  validateChronology(encounters) {
    const errors = [];
    const warnings = [];

    if (encounters.length < 2) {
      warnings.push('Insufficient encounters for chronology validation');
      return { errors, warnings };
    }

    // Sort by date
    const sorted = encounters
      .filter(e => e.encounterDate && !isNaN(Date.parse(e.encounterDate)))
      .sort((a, b) => new Date(a.encounterDate) - new Date(b.encounterDate));

    if (sorted.length === 0) {
      errors.push('No valid encounter dates for chronology check');
      return { errors, warnings };
    }

    let lastDate = null;
    for (const encounter of sorted) {
      const currDate = new Date(encounter.encounterDate);

      // Check for logical gaps
      if (lastDate) {
        const daysDiff = (currDate - lastDate) / (1000 * 60 * 60 * 24);
        if (daysDiff < 0) {
          errors.push(`Chronological disorder: ${encounter.encounterDate}`);
        } else if (daysDiff > 1095) {  // 3 years
          warnings.push(`Large gap in encounters: ${daysDiff.toFixed(0)} days`);
        }
      }

      lastDate = currDate;
    }

    return { errors, warnings };
  }

  /**
   * Validate treatment providers
   */
  validateProviders(providers) {
    const errors = [];
    const warnings = [];

    if (providers.length === 0) {
      warnings.push('No treatment providers documented');
    }

    for (const provider of providers) {
      if (!provider.providerType || !['Physician', 'Nurse', 'Corpsman', 'Medic', 'PA', 'NP', 'Dentist'].includes(provider.providerType)) {
        errors.push(`Invalid provider type: ${provider.providerType}`);
      }

      if (!provider.facility) {
        errors.push('Provider missing facility name');
      }

      if (!provider.firstEncounterDate || isNaN(Date.parse(provider.firstEncounterDate))) {
        errors.push(`Invalid provider first encounter date: ${provider.firstEncounterDate}`);
      }
    }

    return { errors, warnings };
  }
}

module.exports = STRValidators;
