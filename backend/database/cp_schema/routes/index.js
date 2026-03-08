const express = require('express');
const router = express.Router();

// Veterans
router.post('/veterans', require('./veterans').createVeteran);
router.get('/veterans/:veteranId', require('./veterans').getVeteran);
router.patch('/veterans/:veteranId', require('./veterans').updateVeteran);
router.get('/veterans/:veteranId/service-periods', require('./veterans').getServicePeriods);
router.post('/veterans/:veteranId/service-periods', require('./veterans').addServicePeriod);
router.get('/veterans/:veteranId/representatives', require('./veterans').getRepresentatives);
router.put('/veterans/:veteranId/representatives/:representativeId', require('./veterans').upsertRepresentative);

// Claims
router.post('/claims', require('./claims').createClaim);
router.get('/claims/:claimId', require('./claims').getClaim);
router.patch('/claims/:claimId', require('./claims').updateClaim);
router.post('/claims/:claimId/status-transitions', require('./claims').addStatusTransition);
router.get('/claims/:claimId/status-history', require('./claims').getStatusHistory);
router.post('/claims/:claimId/contentions', require('./claims').addContention);
router.patch('/claims/:claimId/contentions/:contentionId', require('./claims').updateContention);
router.post('/claims/:claimId/evidence', require('./claims').addEvidence);
router.post('/claims/:claimId/contentions/:contentionId/evidence/:evidenceId', require('./claims').linkEvidence);

// C&P Exams
router.post('/claims/:claimId/exams', require('./exams').createExam);
router.patch('/exams/:examId', require('./exams').updateExam);
router.post('/exams/:examId/findings', require('./exams').addFinding);
router.get('/claims/:claimId/exams', require('./exams').listExams);

// Rating Decisions
router.post('/claims/:claimId/rating-decisions', require('./ratings').createRatingDecision);
router.post('/rating-decisions/:ratingDecisionId/issues', require('./ratings').addRatingIssue);
router.put('/rating-decisions/:ratingDecisionId/combined-rating', require('./ratings').upsertCombinedRating);
router.post('/rating-issues/:ratingIssueId/citations', require('./ratings').addCitation);
router.post('/rating-issues/:ratingIssueId/authorities/:authorityCitationId', require('./ratings').mapAuthority);
router.get('/claims/:claimId/rating-decisions/latest', require('./ratings').getLatestDecision);

// Pension
router.post('/veterans/:veteranId/pension-profiles', require('./pension').createProfile);
router.patch('/pension-profiles/:pensionProfileId', require('./pension').updateProfile);
router.post('/pension-profiles/:pensionProfileId/income-sources', require('./pension').addIncomeSource);
router.post('/pension-profiles/:pensionProfileId/assets', require('./pension').addAsset);
router.post('/pension-profiles/:pensionProfileId/deductions', require('./pension').addDeduction);
router.post('/pension-profiles/:pensionProfileId/awards', require('./pension').addAward);

// Payments
router.post('/veterans/:veteranId/payment-accounts', require('./payments').createAccount);
router.post('/veterans/:veteranId/payments', require('./payments').recordPayment);
router.get('/veterans/:veteranId/payments', require('./payments').listPayments);
router.post('/veterans/:veteranId/overpayment-debts', require('./payments').createDebt);
router.patch('/overpayment-debts/:overpaymentDebtId', require('./payments').updateDebt);

// Appeals
router.post('/claims/:claimId/appeals', require('./appeals').createAppeal);
router.patch('/appeals/:appealId', require('./appeals').updateAppeal);
router.post('/appeals/:appealId/issues', require('./appeals').addAppealIssue);
router.post('/appeals/:appealId/hearings', require('./appeals').scheduleHearing);
router.patch('/hearings/:hearingId', require('./appeals').updateHearing);
router.get('/claims/:claimId/appeals', require('./appeals').listAppeals);

// Documents
router.post('/documents', require('./documents').registerDocument);
router.get('/documents/:documentId', require('./documents').getDocument);

// Audit
router.post('/audit/events', require('./audit').appendEvent);
router.post('/compliance/flags', require('./audit').createFlag);
router.patch('/compliance/flags/:complianceFlagId', require('./audit').resolveFlag);

module.exports = router;

