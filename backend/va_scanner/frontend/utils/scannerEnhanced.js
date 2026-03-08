// Enhanced scanner utility
// Improves narrative parsing and disability extraction
// Combines best practices from both Rally Forge and Rally Forge1

export const parseNarrativeEnhanced = (text) => {
  const result = {
    rawText: text,
    disabilities: [],
    ratings: {},
    deniedConditions: [],
    servicePeriods: [],
    effectiveDate: null,
    decisionDate: null,
    claimNumber: null,
    veteranName: null
  };

  // Extract veteran name
  const nameMatch = text.match(/(?:Veteran|Claimant)?\s*[:]*\s*([A-Z][a-zA-Z\s]+)/);
  if (nameMatch) result.veteranName = nameMatch[1].trim();

  // Extract claim number
  const claimMatch = text.match(/Claim[:\s]+(\d{9})/i);
  if (claimMatch) result.claimNumber = claimMatch[1];

  // Extract effective date
  const effDateMatch = text.match(/Effective Date[:\s]+(\\d{1,2}\/\\d{1,2}\/\\d{4})/i);
  if (effDateMatch) result.effectiveDate = new Date(effDateMatch[1]);

  // Extract decision date
  const decisionMatch = text.match(/Decision Date[:\s]+(\\d{1,2}\/\\d{1,2}\/\\d{4})/i);
  if (decisionMatch) result.decisionDate = new Date(decisionMatch[1]);

  // Extract all rated conditions  
  const conditionPatterns = [
    /(?:Condition|Disability|Diagnosis)[\s:]+([A-Za-z\s]+?)[\s]*[-–][\s]*(\d{1,3})%/gi,
    /([A-Za-z\s]+?)[\s]+(\d{1,3})%[\s]*(?:rating|Rated)/gi
  ];

  conditionPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const condition = match[1].trim();
      const rating = parseInt(match[2]);
      if (rating >= 10) { // Only include ratings 10% or above
        result.disabilities.push(condition);
        result.ratings[condition] = rating;
      }
    }
  });

  // Extract denied conditions
  const deniedPatterns = [
    /(?:Denied|Rejected)[\s:]+([A-Za-z\s]+?)(?:\.|\n|Reason)/gi,
    /([A-Za-z\s]+?)[\s]+(?:is not|was not|denied|not rated)(?:.*?)?(?:service[–-]connected|insufficient|preexisting)/gi
  ];

  deniedPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const condition = match[1].trim();
      if (condition.length > 3) {
        result.deniedConditions.push({
          name: condition,
          denialReason: 'Extracted from narrative'
        });
      }
    }
  });

  // Remove duplicates
  result.disabilities = [...new Set(result.disabilities)];
  result.deniedConditions = result.deniedConditions.filter((c, i, arr) => 
    arr.findIndex(x => x.name === c.name) === i
  );

  return result;
};

// Classify disabilities with enhanced logic
export const classifyDisabilitiesEnhanced = (disabilities, serviceInfo, narrativeResult) => {
  const presumptives = {
    'Agent Orange': {
      conditions: ['Diabetes Type 2', 'Prostate Cancer', 'Respiratory Cancer', 'PTSD', 'Chloracne', 'Neuropathy'],
      exposure: 'Vietnam War Agent Orange exposure'
    },
    'Radiation': {
      conditions: ['Leukemia', 'Thyroid Disease', 'Breast Cancer', 'Lung Cancer'],
      exposure: 'Radiation exposure'
    },
    'Gulf War': {
      conditions: ['Chronic Fatigue Syndrome', 'Fibromyalgia', 'IBS'],
      exposure: 'Post-1990 Gulf War Area Service'  
    },
    'GWOT': {
      conditions: ['PTSD', 'TBI', 'IED-related hearing loss', 'Tinnitus'],
      exposure: 'Global War on Terrorism Service'
    }
  };

  const secondaryConditions = {
    'PTSD': ['Sleep Disorder', 'Anxiety Disorder', 'Depression', 'IBS', 'Migraine'],
    'TBI': ['Headaches', 'Cognitive Issues', 'Memory Problems', 'PTSD', 'Balance Issues'],
    'Diabetes': ['Peripheral Neuropathy', 'Kidney Disease', 'Vision Problems'],
    'Hearing Loss': ['Tinnitus', 'Vertigo', 'Balance Disorder']
  };

  const result = {
    serviceConnected: [],
    nonServiceConnected: [],
    potentiallyServiceConnectable: []
  };

  disabilities.forEach(disability => {
    let found = false;

    // Check if rated in narrative (implies SC)
    if (narrativeResult?.ratings && narrativeResult.ratings[disability]) {
      result.serviceConnected.push({
        name: disability,
        rating: narrativeResult.ratings[disability],
        evidenceSource: 'VA Rating Decision',
        classificationReason: 'Rated service-connected condition'
      });
      found = true;
    }

    // Check presumptive
    if (!found) {
      Object.entries(presumptives).forEach(([exposure, data]) => {
        if (data.conditions.some(c => c.toLowerCase() === disability.toLowerCase())) {
          // Check if veteran has the exposure
          if ((exposure === 'Agent Orange' && serviceInfo?.theaterExposure?.includes('Vietnam')) ||
              (exposure === 'Radiation' && serviceInfo?.theaterExposure?.includes('Radiation')) ||
              (exposure === 'Gulf War' && serviceInfo?.component === 'Active Duty' && serviceInfo?.year >= 1990) ||
              (exposure === 'GWOT' && ['OEF', 'OIF', 'OND'].some(t => serviceInfo?.servicePeriods?.some(p => p.theater === t)))) {
            result.serviceConnected.push({
              name: disability,
              rating: null,
              evidenceSource: `Presumptive - ${exposure}`,
              classificationReason: `Presumptive disease for ${exposure} exposure`
            });
            found = true;
          }
        }
      });
    }

    // Check secondary
    if (!found) {
      Object.entries(secondaryConditions).forEach(([primary, secondaries]) => {
        if (secondaries.some(s => s.toLowerCase() === disability.toLowerCase()) &&
            disabilities.some(d => d.toLowerCase() === primary.toLowerCase())) {
          result.potentiallyServiceConnectable.push({
            name: disability,
            rating: null,
            evidenceSource: 'Potentially secondary to ' + primary,
            classificationReason: `May be service-connected as secondary to ${primary}`,
            primaryCondition: primary
          });
          found = true;
        }
      });
    }

    // Default to NSC if not found
    if (!found) {
      result.nonServiceConnected.push({
        name: disability,
        rating: null,
        evidenceSource: 'Narrative text extraction',
        classificationReason: 'Not yet classified as service-connected. May need additional evidence.'
      });
    }
  });

  return result;
};

// Extract and categorize denial reasons
export const extractDenialReasons = (text) => {
  const denialReasons = [
    'Insufficient evidence of diagnosis',
    'Insufficient evidence of connection',
    'Not in line of duty',
    'Preexisting condition',
    'Not a disability',
    'Claimed condition not identified',
    'Medical evidence does not support',
    'Presumptive date requirements not met',
    'Duplicate of another condition',
    'Service medical records show no evidence'
  ];

  const found = [];
  denialReasons.forEach(reason => {
    if (text.toLowerCase().includes(reason.toLowerCase())) {
      found.push(reason);
    }
  });

  return found;
};

