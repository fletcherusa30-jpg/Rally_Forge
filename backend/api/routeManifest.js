import scannerRouter from './scanner.js';
import compensationRouter from './compensation.js';
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
import auditMetadataRouter from './auditMetadata.js';
import evidenceGraphRouter from './evidenceGraph.js';

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
    { path: '/api/reviews', router: reviewQueueRouter, category: 'core' },
    { path: '/api/claim-workspace', router: claimWorkspaceRouter, category: 'core' },
    { path: '/api/knowledge', router: knowledgeRouter, category: 'core' },
    { path: '/api/cfr', router: cfrRouter, category: 'core' },

    { path: '/api/authority', router: authorityRouter, category: 'extended' },
    { path: '/api/pathways', router: pathwaysRouter, category: 'extended' },
    { path: '/api/benefits', router: recalculateRouter, category: 'extended' },
    { path: '/api/scanner', router: scannerDiagnosticsRouter, category: 'extended' },
    { path: '/api/ai', router: aiAnalysisRouter, category: 'extended' },
    { path: '/api/ai-test', router: aiTestRouter, category: 'extended' },
    { path: '/api/evidence-graph', router: evidenceGraphRouter, category: 'core' },
  ];
}


