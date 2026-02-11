/**
 * @typedef {Object} ServicePeriod
 * @property {string} startDate - ISO date string (YYYY-MM-DD).
 * @property {string|null} endDate - ISO date string or null when active.
 * @property {string|null} [theater] - Optional deployment theater.
 */

/**
 * @typedef {Object} OnboardingResult
 * @property {string} branch
 * @property {string} component
 * @property {ServicePeriod[]} servicePeriods
 * @property {"yes"|"no"|"not_sure"} combatSelfReported
 * @property {boolean} disabilityRatingKnown
 * @property {number|null} disabilityRatingPercent
 * @property {string} stateOfResidence
 * @property {string[]} [awards]
 */

export {};
