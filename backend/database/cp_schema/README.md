# VA Compensation & Pension Schema Package

Production-grade PostgreSQL schema for the VA C&P domain.

## Files

- **01_cp_relational_schema.sql** – Full PostgreSQL DDL with schema, types, tables, indexes, triggers
- **cp_schema.json** – JSON entity/relationship manifest (all entities, enums, PK/FK)
- **ERD.md** – Text-based entity–relationship diagram with Mermaid syntax
- **api-endpoints.md** – Recommended REST endpoint specifications
- **migrations/** – Version-controlled DDL change scripts
- **seeds/** – Reference seed data templates
- **routes/** – Express route handler scaffolds

## Usage

### Apply Schema

```bash
psql -U postgres -d rally_forge -f backend/database/cp_schema/01_cp_relational_schema.sql
```

### Run Migrations

```bash
node backend/database/cp_schema/migrations/apply.js
```

### Seed Reference Data

```bash
node backend/database/cp_schema/seeds/apply.js
```

### Mount Routes

```javascript
const cpRoutes = require('./database/cp_schema/routes');
app.use('/api/v1', cpRoutes);
```

## Schema Version

**1.0.0** (2026-02-16)

## Entities

**Core:** veterans, veteran_identifiers, service_periods, contacts, addresses, representatives, veteran_representatives  
**Claims:** claims, claim_status_history, contentions, evidence_items, contention_evidence  
**Exams:** cp_exams, exam_findings  
**Decisions:** rating_decisions, rating_issues, decision_citations, combined_ratings  
**Compensation:** compensation_awards  
**Pension:** pension_profiles, pension_income_sources, pension_assets, pension_deductions, pension_awards  
**Payments:** payment_accounts, payment_transactions, overpayment_debts  
**Appeals:** appeals, appeal_issues, hearings  
**Governance:** documents, authority_citations, issue_authority_map, audit_events, compliance_flags

## Compliance

All tables enforce referential integrity, temporal tracking, and audit-ready immutable logging.
