# Recommended REST Endpoints (Deterministic)

Reference implementation contracts:
- [STR API Contract](./strs-api-contract.md)

Base path: `/api/v1`

## Veterans

- `POST /veterans` create veteran profile.
- `GET /veterans/{veteranId}` fetch veteran + profile summary.
- `PATCH /veterans/{veteranId}` update demographic data.
- `GET /veterans/{veteranId}/service-periods` list service history.
- `POST /veterans/{veteranId}/service-periods` add service period.
- `GET /veterans/{veteranId}/representatives` active POA links.
- `PUT /veterans/{veteranId}/representatives/{representativeId}` upsert POA assignment.

## Claims Lifecycle

- `POST /claims` create claim.
- `GET /claims/{claimId}` claim aggregate.
- `PATCH /claims/{claimId}` update non-status fields.
- `POST /claims/{claimId}/status-transitions` append status transition.
- `GET /claims/{claimId}/status-history` full lifecycle timeline.
- `POST /claims/{claimId}/contentions` add contention.
- `PATCH /claims/{claimId}/contentions/{contentionId}` update contention.
- `POST /claims/{claimId}/evidence` register evidence item.
- `POST /claims/{claimId}/contentions/{contentionId}/evidence/{evidenceId}` create evidence linkage.

## C&P Exams

- `POST /claims/{claimId}/exams` request C&P exam.
- `PATCH /exams/{examId}` update scheduling/status details.
- `POST /exams/{examId}/findings` append finding.
- `GET /claims/{claimId}/exams` list exams for claim.

## Rating Decisions

- `POST /claims/{claimId}/rating-decisions` create decision shell.
- `POST /rating-decisions/{ratingDecisionId}/issues` add adjudicated issue.
- `PUT /rating-decisions/{ratingDecisionId}/combined-rating` upsert combined rating.
- `POST /rating-issues/{ratingIssueId}/citations` add legal citation.
- `POST /rating-issues/{ratingIssueId}/authorities/{authorityCitationId}` map normalized authority.
- `GET /claims/{claimId}/rating-decisions/latest` latest decision snapshot.

## Pension Financials

- `POST /veterans/{veteranId}/pension-profiles` create profile.
- `PATCH /pension-profiles/{pensionProfileId}` update flags and MAPR category.
- `POST /pension-profiles/{pensionProfileId}/income-sources` add countable income source.
- `POST /pension-profiles/{pensionProfileId}/assets` add net-worth asset.
- `POST /pension-profiles/{pensionProfileId}/deductions` add deductible expense.
- `POST /pension-profiles/{pensionProfileId}/awards` record annual/monthly pension outcome.

## Payments and Debt

- `POST /veterans/{veteranId}/payment-accounts` add payment destination.
- `POST /veterans/{veteranId}/payments` record payment transaction.
- `GET /veterans/{veteranId}/payments?from=YYYY-MM-DD&to=YYYY-MM-DD` payment history.
- `POST /veterans/{veteranId}/overpayment-debts` register debt.
- `PATCH /overpayment-debts/{overpaymentDebtId}` update balance/waiver status.

## Appeals

- `POST /claims/{claimId}/appeals` create appeal lane entry.
- `PATCH /appeals/{appealId}` update lane status/disposition.
- `POST /appeals/{appealId}/issues` add issue under appeal.
- `POST /appeals/{appealId}/hearings` schedule hearing.
- `PATCH /hearings/{hearingId}` update held date/outcome.
- `GET /claims/{claimId}/appeals` list appeal timeline.

## Documents + Governance

- `POST /documents` register indexed document metadata.
- `GET /documents/{documentId}` resolve metadata.
- `POST /audit/events` append immutable audit record.
- `POST /compliance/flags` create compliance signal.
- `PATCH /compliance/flags/{complianceFlagId}` resolve/close signal.

## Deterministic Response Contracts

- Every write endpoint returns payload with: `id`, `createdAt`, `updatedAt` (when applicable), and `version`.
- Every list endpoint supports: `limit`, `offset`, `sort`, and stable sort fallback by primary key.
- Every mutating endpoint accepts `Idempotency-Key` header and returns same body for repeated key+payload.
- All timestamps are UTC ISO-8601 and all money fields use string decimal serialization (e.g., `"1234.56"`).
