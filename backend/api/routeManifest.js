import scannerRouter from './scanner.js';
import jobsRouter from './jobs.js';
import educationResourceRouter from './education.js';
import housingRouter from './housing.js';
import legalRouter from './legal.js';
import mentalHealthResourceRouter from './mentalHealth.js';
import skillBridgeRouter from './skillBridge.js';
import compensationRouter from './compensation.js';
import timelineRouter from './timeline.js';
import readinessRouter from './readiness.js';
import dd214Router from './dd214.js';
import strRouter from './str.js';
import ratingRouter from './rating.js';
import caseContextRouter from './caseContext.js';
import claimsRouter from './claims.js';
import documentVaultRouter from './documentVault.js';
import financialRouter from './financial.js';
import healthRouter from './health.js';
import strsRouter from './strs.js';
import militaryRouter from './military.js';
import knowledgeRouter from './knowledge.js';
import cfrRouter from './cfr.js';
import casesRouter from './cases.js';
import intelligenceRouter from './intelligence.js';
import stateBenefitsRouter from './stateBenefits.js';
import reviewQueueRouter from './reviewQueue.js';
import claimWorkspaceRouter from './claimWorkspace.js';
import benefitsRouter from './benefits.js';
import onboardingRouter from './onboarding.js';
import authRouter from './auth.js';
import authorityRouter from './authority.js';
import pathwaysRouter from './pathways.js';
import recalculateRouter from './recalculate.js';
import scannerDiagnosticsRouter from './scannerDiagnostics.js';
import aiAnalysisRouter from './aiAnalysisRouter.js';
import aiTestRouter from './aiTestRouter.js';
import aiQualityRouter from './aiQuality.js';
import auditMetadataRouter from './auditMetadata.js';
import evidenceGraphRouter from './evidenceGraph.js';
import eligibilityRouter from './eligibility.js';
import transitionRouter from './transition.js';

export function buildRouteManifest({ authLimiter }) {
  return [
    { path: '/api/health', router: healthRouter, category: 'public' },
    { path: '/api/audit', router: auditMetadataRouter, category: 'public' },
    { path: '/api/auth', router: authRouter, middlewares: [authLimiter], category: 'public' },

    { path: '/api/scanner', router: scannerRouter, category: 'core' },
    { path: '/api/strs', router: strsRouter, category: 'core' },
    { path: '/api/compensation', router: compensationRouter, category: 'core' },
    { path: '/api/financial', router: financialRouter, category: 'core' },
    { path: '/api/military', router: militaryRouter, category: 'core' },
    { path: '/api/cases', router: casesRouter, category: 'core' },
    { path: '/api/benefits', router: benefitsRouter, category: 'core' },
    { path: '/api/onboarding', router: onboardingRouter, category: 'core' },
    { path: '/api/state-benefits', router: stateBenefitsRouter, category: 'core' },
    { path: '/api/intelligence', router: intelligenceRouter, category: 'core' },
    { path: '/api/eligibility', router: eligibilityRouter, category: 'core' },
    { path: '/api/transition', router: transitionRouter, category: 'core' },
    { path: '/api/dd214', router: dd214Router, category: 'core' },
    { path: '/api/str', router: strRouter, category: 'core' },
    { path: '/api/rating', router: ratingRouter, category: 'core' },
    { path: '/api/case-context', router: caseContextRouter, category: 'core' },
    { path: '/api/claims', router: claimsRouter, category: 'core' },
    { path: '/api/document-vault', router: documentVaultRouter, category: 'core' },

    { path: '/api/jobs', router: jobsRouter, category: 'resources' },
    { path: '/api/education', router: educationResourceRouter, category: 'resources' },
    { path: '/api/resources/education', router: educationResourceRouter, category: 'resources' },
    { path: '/api/housing', router: housingRouter, category: 'resources' },
    { path: '/api/resources/housing', router: housingRouter, category: 'resources' },
    { path: '/api/legal', router: legalRouter, category: 'resources' },
    { path: '/api/resources/legal', router: legalRouter, category: 'resources' },
    { path: '/api/mental-health', router: mentalHealthResourceRouter, category: 'resources' },
    { path: '/api/resources/mental-health', router: mentalHealthResourceRouter, category: 'resources' },
    { path: '/api/skillbridge', router: skillBridgeRouter, category: 'resources' },
    { path: '/api/resources/skillbridge', router: skillBridgeRouter, category: 'resources' },
    { path: '/api/timeline', router: timelineRouter, category: 'resources' },
    { path: '/api/resources/timeline', router: timelineRouter, category: 'resources' },
    { path: '/api/readiness-score', router: readinessRouter, category: 'resources' },
    { path: '/api/resources/readiness', router: readinessRouter, category: 'resources' },
    { path: '/api/resources/jobs', router: jobsRouter, category: 'resources' },
    { path: '/api/reviews', router: reviewQueueRouter, category: 'core' },
    { path: '/api/claim-workspace', router: claimWorkspaceRouter, category: 'core' },
    { path: '/api/knowledge', router: knowledgeRouter, category: 'core' },
    { path: '/api/cfr', router: cfrRouter, category: 'core' },

    { path: '/api/authority', router: authorityRouter, category: 'extended' },
    { path: '/api/pathways', router: pathwaysRouter, category: 'extended' },
    { path: '/api/recalculate', router: recalculateRouter, category: 'extended' },
    { path: '/api/scanner-diagnostics', router: scannerDiagnosticsRouter, category: 'extended' },
    { path: '/api/ai', router: aiAnalysisRouter, category: 'extended' },
    { path: '/api/ai-test', router: aiTestRouter, category: 'extended' },
    { path: '/api/ai-quality', router: aiQualityRouter, category: 'extended' },
    { path: '/api/evidence-graph', router: evidenceGraphRouter, category: 'core' },
  ];
}


