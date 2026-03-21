/**
 * spdReCodes.js — Rally Forge DD-214 Scanner v3.1
 *
 * SPD (Separation Program Designator) and RE (Reentry) Code lookup tables.
 * Used for cross-validation only.
 *
 * SAFETY NOTICE: Code lookups are informational indicators only.
 * The scanner NEVER interprets these codes as legal outcomes or eligibility
 * determinations. All output is for human review only.
 */

/**
 * Common SPD codes and their general descriptions.
 * Source: AR 635-5-1 / DoD FMR Vol 7A. Abbreviated list for validation.
 */
export const SPD_CODES = {
  // Disability retirement & disability separation
  SEJ: 'Disability, Permanent',
  SFJ: 'Disability, Temporary',
  SFK: 'Disability, Temporary (Non-Duty)',
  SFX: 'Disability, Permanent (Non-Duty)',
  JEA: 'Disability, Severance Pay',
  JEB: 'Disability, Severance Pay (Combat-Related)',
  JEC: 'Disability, Severance Pay (Non-Combat)',
  JED: 'Disability, Severance Pay (Combat-Related, Enhanced)',
  JEF: 'Disability, Existed Prior to Service (EPTS)',
  JEN: 'Disability, Not in Line of Duty',

  // Medical separation (non-retirement)
  JFV: 'Physical Standards',
  JFW: 'Medical Board (Non-Duty)',
  JFX: 'Medical Board (Duty-Related)',
  JFL: 'Physical Disability (Non-Duty)',
  JFM: 'Physical Disability (Duty-Related)',

  // Administrative separation
  JFF: 'Secretarial Authority',
  JND: 'Miscellaneous/General Reasons',
  JNC: 'Reduction in Force',
  JNF: 'Early Release to Attend School',
  JNE: 'Early Release to Accept Civilian Job',
  JNP: 'Early Release - Seasonal Employment',
  JNR: 'Early Release - Insufficient Retainability',
  JNS: 'Early Release - Pregnancy',
  JNT: 'Early Release - Hardship',
  JNU: 'Early Release - Dependency',
  JNY: 'Early Release - Parenthood',
  LBK: 'Expiration Term of Service',

  // Misconduct-related separation
  JKQ: 'Misconduct (Serious Offense)',
  JKA: 'Misconduct (Pattern)',
  JKB: 'Misconduct (Drug Abuse)',
  JKC: 'Misconduct (Commission of a Serious Offense)',
  JKE: 'Misconduct (Civil Conviction)',
  JKN: 'Misconduct (Minor Infractions)',

  // Performance / failure
  JHJ: 'Unsatisfactory Performance',
  JHF: 'Failure to Meet Minimum Standards',
  JHK: 'Failure to Maintain Weight Standards',
  JCR: 'Failure to Complete Course of Instruction',
  JDA: 'Failure to Adapt',

  // Entry-level & training
  JGA: 'Entry-Level Performance & Conduct',
  JGB: 'Entry-Level Medical Condition',
  JFC: 'Entry-Level Physical Standards',
  JFT: 'Failure to Complete Training',

  // Retirement (non-medical)
  RBD: 'Sufficient Service for Retirement',
  RBE: 'Early Retirement',
  RBF: 'Temporary Early Retirement Authority (TERA)',
  RCC: 'Mandatory Retirement - Age',
  RCD: 'Mandatory Retirement - Service Limits',

  // Other high-value codes
  JCC: 'Conscientious Objector',
  JDG: 'Alcohol Rehabilitation Failure',
  JDP: 'Drug Rehabilitation Failure',
  JDT: 'Security Reasons',
  JEX: 'Failure to Meet Commissioning Standards',
  JGH: 'Pregnancy-Related Separation',

  // Bad conduct / dishonorable
  JJB: 'Bad Conduct Discharge (Special Court-Martial)',
  JJA: 'Bad Conduct Discharge (General Court-Martial)',
  JJD: 'Dishonorable Discharge',

  // Additional administrative / voluntary separation
  KBK: 'Expiration of Enlistment (USMC/Navy)',
  KBR: 'Expiration of Active Service',
  MBK: 'Expiration of Enlistment (USMC)',
  LCC: 'Reduction in Authorized Strength',
  LKA: 'Misconduct — Pattern (Active Component)',
  LKQ: 'Misconduct — Serious Offense (Active Component)',
  JPD: 'Parenthood (Unable to Meet Requirements)',
  JPC: 'Physical Profile (Non-Retention Standard)',
  JMB: 'Failure to Meet Body Composition Standards',
  JMI: 'Failure to Meet Physical Fitness Standards',
  KGH: 'Pregnancy, Reserve Component',

  // IDES / MEB specific
  SEXX: 'Permanent Disability Retirement (PDRL)',
  SFXX: 'Temporary Disability Retirement (TDRL)',

  // Air Force specific
  FBD: 'Retirement (Air Force — Sufficient Service)',
  FCC: 'Mandatory Retirement — Age (Air Force)',
  FND: 'Miscellaneous Reasons (Air Force)',
  FKQ: 'Misconduct — Commission of Serious Offense (Air Force)',
  FGA: 'Entry-Level Performance (Air Force)',
  FHJ: 'Unsatisfactory Performance (Air Force)',
  FBK: 'Expiration of Term of Service (Air Force)',

  // Navy / Marine Corps specific
  BFS: 'Transfer to Fleet Reserve (Navy)',
  NND: 'Misconduct (Navy)',
  MND: 'General (Marine Corps)',
  MGA: 'Entry-Level Performance (Marine Corps)',
};

/**
 * RE code descriptions.
 * Source: AR 601-210 / DoD FMR. These are not legal determinations.
 */
export const RE_CODES = {
  '1': 'Eligible for reenlistment; no disqualifying factors.',
  '2': 'Not currently eligible for reenlistment but waiver may be available.',
  '3': 'Not eligible for reenlistment without waiver; waiver typically required.',
  '3A': 'Completion of service; eligible under certain conditions.',
  '3B': 'Not eligible; failing to meet physical standards.',
  '3C': 'Not eligible; not medically qualified.',
  '3D': 'Not eligible; conscientious objector.',
  '3E': 'Not eligible; failure to complete required training.',
  '4': 'Not eligible for reenlistment; generally ineligible for waiver.',
  '6': 'Not eligible; moral, administrative, or security grounds.',
  'J': 'Not eligible for reenlistment (USMC specific).',
  'RE-1': 'Eligible for reenlistment.',
  'RE-2': 'Eligible with waiver',
  'RE-3': 'Not eligible without waiver.',
  'RE-4': 'Not eligible; permanently barred.',
  '4A': 'Not eligible; AWOL or desertion.',
  '4B': 'Not eligible; barred from reenlistment.',
  '4C': 'Not eligible; moral or administrative disqualifications.',
};

/**
 * Check whether an SPD code is in the lookup table.
 * @param {string} code
 * @returns {{ known: boolean, description: string|null }}
 */
export function lookupSPDCode(code) {
  const upper = String(code || '').toUpperCase().trim();
  const description = SPD_CODES[upper] || null;
  return { known: !!description, description, code: upper };
}

/**
 * Check whether an RE code is in the lookup table.
 * @param {string} code
 * @returns {{ known: boolean, description: string|null }}
 */
export function lookupRECode(code) {
  const normalized = String(code || '').trim();
  const description = RE_CODES[normalized] || null;
  return { known: !!description, description, code: normalized };
}
