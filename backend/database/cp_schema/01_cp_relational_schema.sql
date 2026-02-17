BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS cp;

CREATE TYPE cp.claim_program AS ENUM ('compensation', 'pension', 'survivor', 'dependency');
CREATE TYPE cp.claim_type AS ENUM ('original', 'increase', 'supplemental', 'higher_level_review', 'board_appeal', 'legacy_appeal', 'dependency', 'fiduciary', 'other');
CREATE TYPE cp.claim_status AS ENUM ('draft', 'received', 'triage', 'evidence_gathering', 'exam_scheduling', 'rating', 'authorization', 'decided', 'closed', 'cancelled');
CREATE TYPE cp.contention_type AS ENUM ('service_connection', 'increase', 'secondary', 'aggravation', 'presumptive', 'special_monthly_compensation', 'tDIU', 'pension_issue', 'dependency_issue', 'other');
CREATE TYPE cp.contention_disposition AS ENUM ('granted', 'denied', 'deferred', 'remanded', 'withdrawn', 'dismissed');
CREATE TYPE cp.evidence_type AS ENUM ('service_treatment_record', 'private_medical_record', 'va_medical_record', 'lay_statement', 'dbq', 'c_and_p_exam', 'medical_opinion', 'form', 'financial_document', 'other');
CREATE TYPE cp.exam_status AS ENUM ('requested', 'scheduled', 'completed', 'cancelled', 'no_show', 'clarification_requested');
CREATE TYPE cp.decision_type AS ENUM ('rating_decision', 'hlr_decision', 'board_decision', 'supplemental_decision', 'administrative_decision');
CREATE TYPE cp.payment_type AS ENUM ('compensation', 'pension', 'retroactive', 'dependency_adjustment', 'special_monthly_compensation', 'withholding', 'recoupment', 'other');
CREATE TYPE cp.appeal_lane AS ENUM ('supplemental', 'higher_level_review', 'board_direct', 'board_evidence', 'board_hearing', 'legacy');
CREATE TYPE cp.appeal_status AS ENUM ('received', 'in_review', 'duty_to_assist_error', 'soc_issued', 'ssoc_issued', 'certified_to_board', 'board_pending', 'decided', 'closed');
CREATE TYPE cp.hearing_type AS ENUM ('informal_conference', 'dro_hearing', 'board_virtual', 'board_travel', 'board_video', 'none');
CREATE TYPE cp.audit_actor_type AS ENUM ('system', 'user', 'service', 'job');
CREATE TYPE cp.document_source AS ENUM ('upload', 'va_api', 'scanner', 'manual_entry', 'migration');

CREATE TABLE cp.veterans (
    veteran_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    va_file_number VARCHAR(32) UNIQUE,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    suffix TEXT,
    date_of_birth DATE,
    date_of_death DATE,
    sex_at_birth TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.veteran_identifiers (
    identifier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    identifier_type TEXT NOT NULL,
    identifier_value TEXT NOT NULL,
    issuer TEXT,
    effective_from DATE,
    effective_to DATE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (identifier_type, identifier_value)
);

CREATE TABLE cp.service_periods (
    service_period_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    branch TEXT NOT NULL,
    service_component TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    characterization TEXT,
    pay_grade TEXT,
    theater TEXT,
    deployed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.contacts (
    contact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    contact_type TEXT NOT NULL,
    value TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (veteran_id, contact_type, value)
);

CREATE TABLE cp.addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    address_type TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    state_province TEXT,
    postal_code TEXT,
    country_code CHAR(2) NOT NULL,
    valid_from DATE,
    valid_to DATE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.representatives (
    representative_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_type TEXT NOT NULL,
    organization_name TEXT,
    first_name TEXT,
    last_name TEXT,
    accreditation_number TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.veteran_representatives (
    veteran_representative_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    representative_id UUID NOT NULL REFERENCES cp.representatives(representative_id) ON DELETE RESTRICT,
    poa_form_code TEXT,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.claims (
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    claim_number TEXT NOT NULL UNIQUE,
    program cp.claim_program NOT NULL,
    claim_type cp.claim_type NOT NULL,
    source_channel TEXT NOT NULL,
    date_received DATE NOT NULL,
    date_established DATE,
    current_status cp.claim_status NOT NULL,
    station_of_jurisdiction TEXT,
    end_product_code TEXT,
    suspense_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.claim_status_history (
    claim_status_history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES cp.claims(claim_id) ON DELETE CASCADE,
    status cp.claim_status NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    changed_by TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.contentions (
    contention_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES cp.claims(claim_id) ON DELETE CASCADE,
    contention_code TEXT,
    contention_name TEXT NOT NULL,
    contention_type cp.contention_type NOT NULL,
    body_system TEXT,
    is_bilateral BOOLEAN NOT NULL DEFAULT FALSE,
    side TEXT,
    diagnostic_code TEXT,
    date_claimed DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (claim_id, contention_name, COALESCE(side, 'none'))
);

CREATE TABLE cp.evidence_items (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES cp.claims(claim_id) ON DELETE CASCADE,
    evidence_type cp.evidence_type NOT NULL,
    title TEXT NOT NULL,
    source TEXT,
    received_date DATE,
    document_date DATE,
    is_material BOOLEAN NOT NULL DEFAULT TRUE,
    relevance_score NUMERIC(5,4),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.contention_evidence (
    contention_evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contention_id UUID NOT NULL REFERENCES cp.contentions(contention_id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES cp.evidence_items(evidence_id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (contention_id, evidence_id)
);

CREATE TABLE cp.cp_exams (
    exam_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES cp.claims(claim_id) ON DELETE CASCADE,
    contention_id UUID REFERENCES cp.contentions(contention_id) ON DELETE SET NULL,
    exam_type TEXT NOT NULL,
    vendor_name TEXT,
    facility_name TEXT,
    request_date DATE,
    scheduled_date DATE,
    completed_date DATE,
    examiner_name TEXT,
    examiner_specialty TEXT,
    status cp.exam_status NOT NULL,
    dbq_form_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.exam_findings (
    exam_finding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES cp.cp_exams(exam_id) ON DELETE CASCADE,
    finding_code TEXT,
    finding_name TEXT NOT NULL,
    value_text TEXT,
    value_numeric NUMERIC(12,4),
    value_unit TEXT,
    is_positive BOOLEAN,
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.rating_decisions (
    rating_decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES cp.claims(claim_id) ON DELETE CASCADE,
    decision_type cp.decision_type NOT NULL,
    decision_date DATE NOT NULL,
    notification_date DATE,
    promulgation_date DATE,
    signed_by TEXT,
    quality_review_flag BOOLEAN NOT NULL DEFAULT FALSE,
    narrative_document_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.rating_issues (
    rating_issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_decision_id UUID NOT NULL REFERENCES cp.rating_decisions(rating_decision_id) ON DELETE CASCADE,
    contention_id UUID REFERENCES cp.contentions(contention_id) ON DELETE SET NULL,
    issue_name TEXT NOT NULL,
    disposition cp.contention_disposition NOT NULL,
    service_connected BOOLEAN,
    diagnostic_code TEXT,
    percentage_assigned INTEGER CHECK (percentage_assigned BETWEEN 0 AND 100),
    effective_date DATE,
    bilateral_factor_applied BOOLEAN NOT NULL DEFAULT FALSE,
    denial_reason_text TEXT,
    rationale_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.decision_citations (
    decision_citation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_issue_id UUID NOT NULL REFERENCES cp.rating_issues(rating_issue_id) ON DELETE CASCADE,
    authority_type TEXT NOT NULL,
    citation TEXT NOT NULL,
    authority_title TEXT,
    excerpt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.combined_ratings (
    combined_rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_decision_id UUID NOT NULL REFERENCES cp.rating_decisions(rating_decision_id) ON DELETE CASCADE,
    computed_combined_percent INTEGER NOT NULL CHECK (computed_combined_percent BETWEEN 0 AND 100),
    stated_combined_percent INTEGER CHECK (stated_combined_percent BETWEEN 0 AND 100),
    bilateral_factor_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
    smc_code TEXT,
    compensation_level TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rating_decision_id)
);

CREATE TABLE cp.compensation_awards (
    compensation_award_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    rating_decision_id UUID REFERENCES cp.rating_decisions(rating_decision_id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_amount NUMERIC(12,2) NOT NULL CHECK (monthly_amount >= 0),
    dependent_increment NUMERIC(12,2) NOT NULL DEFAULT 0,
    smc_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    withholding_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.pension_profiles (
    pension_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    pension_type TEXT NOT NULL,
    mapr_category TEXT,
    aid_and_attendance BOOLEAN NOT NULL DEFAULT FALSE,
    housebound BOOLEAN NOT NULL DEFAULT FALSE,
    dependent_count INTEGER NOT NULL DEFAULT 0 CHECK (dependent_count >= 0),
    effective_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.pension_income_sources (
    pension_income_source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pension_profile_id UUID NOT NULL REFERENCES cp.pension_profiles(pension_profile_id) ON DELETE CASCADE,
    income_type TEXT NOT NULL,
    payer_name TEXT,
    frequency TEXT NOT NULL,
    gross_amount NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
    countable_percent NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (countable_percent BETWEEN 0 AND 100),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.pension_assets (
    pension_asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pension_profile_id UUID NOT NULL REFERENCES cp.pension_profiles(pension_profile_id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    description TEXT,
    fair_market_value NUMERIC(14,2) NOT NULL CHECK (fair_market_value >= 0),
    encumbrance_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (encumbrance_amount >= 0),
    ownership_percent NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (ownership_percent BETWEEN 0 AND 100),
    as_of_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.pension_deductions (
    pension_deduction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pension_profile_id UUID NOT NULL REFERENCES cp.pension_profiles(pension_profile_id) ON DELETE CASCADE,
    deduction_type TEXT NOT NULL,
    annual_amount NUMERIC(12,2) NOT NULL CHECK (annual_amount >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.pension_awards (
    pension_award_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pension_profile_id UUID NOT NULL REFERENCES cp.pension_profiles(pension_profile_id) ON DELETE CASCADE,
    decision_date DATE NOT NULL,
    mapr_amount NUMERIC(12,2) NOT NULL CHECK (mapr_amount >= 0),
    countable_income NUMERIC(12,2) NOT NULL CHECK (countable_income >= 0),
    net_worth_amount NUMERIC(14,2) NOT NULL CHECK (net_worth_amount >= 0),
    annual_pension_amount NUMERIC(12,2) NOT NULL CHECK (annual_pension_amount >= 0),
    monthly_pension_amount NUMERIC(12,2) NOT NULL CHECK (monthly_pension_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.payment_accounts (
    payment_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    account_type TEXT NOT NULL,
    institution_name TEXT,
    routing_last4 CHAR(4),
    account_last4 CHAR(4),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.payment_transactions (
    payment_transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    claim_id UUID REFERENCES cp.claims(claim_id) ON DELETE SET NULL,
    payment_account_id UUID REFERENCES cp.payment_accounts(payment_account_id) ON DELETE SET NULL,
    payment_type cp.payment_type NOT NULL,
    payment_date DATE NOT NULL,
    posted_at TIMESTAMPTZ,
    amount NUMERIC(12,2) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    reference_number TEXT,
    treasury_trace TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.overpayment_debts (
    overpayment_debt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID NOT NULL REFERENCES cp.veterans(veteran_id) ON DELETE CASCADE,
    originating_claim_id UUID REFERENCES cp.claims(claim_id) ON DELETE SET NULL,
    debt_reason TEXT NOT NULL,
    principal_amount NUMERIC(12,2) NOT NULL CHECK (principal_amount >= 0),
    interest_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (interest_amount >= 0),
    balance_amount NUMERIC(12,2) NOT NULL CHECK (balance_amount >= 0),
    established_date DATE NOT NULL,
    waived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.appeals (
    appeal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES cp.claims(claim_id) ON DELETE CASCADE,
    rating_decision_id UUID REFERENCES cp.rating_decisions(rating_decision_id) ON DELETE SET NULL,
    lane cp.appeal_lane NOT NULL,
    docket_number TEXT,
    date_received DATE NOT NULL,
    current_status cp.appeal_status NOT NULL,
    disposition_date DATE,
    disposition_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.appeal_issues (
    appeal_issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appeal_id UUID NOT NULL REFERENCES cp.appeals(appeal_id) ON DELETE CASCADE,
    rating_issue_id UUID REFERENCES cp.rating_issues(rating_issue_id) ON DELETE SET NULL,
    issue_name TEXT NOT NULL,
    sought_outcome TEXT,
    board_disposition cp.contention_disposition,
    remand_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.hearings (
    hearing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appeal_id UUID NOT NULL REFERENCES cp.appeals(appeal_id) ON DELETE CASCADE,
    hearing_type cp.hearing_type NOT NULL,
    scheduled_at TIMESTAMPTZ,
    held_at TIMESTAMPTZ,
    location TEXT,
    presiding_official TEXT,
    transcript_document_id UUID,
    outcome_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veteran_id UUID REFERENCES cp.veterans(veteran_id) ON DELETE SET NULL,
    claim_id UUID REFERENCES cp.claims(claim_id) ON DELETE SET NULL,
    document_type TEXT NOT NULL,
    source cp.document_source NOT NULL,
    source_reference TEXT,
    checksum_sha256 CHAR(64),
    storage_uri TEXT,
    mime_type TEXT,
    page_count INTEGER,
    received_at TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cp.rating_decisions
    ADD CONSTRAINT fk_rating_decisions_narrative_document
    FOREIGN KEY (narrative_document_id) REFERENCES cp.documents(document_id) ON DELETE SET NULL;

ALTER TABLE cp.hearings
    ADD CONSTRAINT fk_hearings_transcript_document
    FOREIGN KEY (transcript_document_id) REFERENCES cp.documents(document_id) ON DELETE SET NULL;

CREATE TABLE cp.authority_citations (
    authority_citation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citation TEXT NOT NULL UNIQUE,
    title TEXT,
    authority_system TEXT NOT NULL,
    part TEXT,
    section TEXT,
    subsection TEXT,
    canonical_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cp.issue_authority_map (
    issue_authority_map_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_issue_id UUID NOT NULL REFERENCES cp.rating_issues(rating_issue_id) ON DELETE CASCADE,
    authority_citation_id UUID NOT NULL REFERENCES cp.authority_citations(authority_citation_id) ON DELETE RESTRICT,
    relation_strength NUMERIC(5,4) NOT NULL DEFAULT 1 CHECK (relation_strength > 0 AND relation_strength <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rating_issue_id, authority_citation_id)
);

CREATE TABLE cp.audit_events (
    audit_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type cp.audit_actor_type NOT NULL,
    actor_id TEXT,
    event_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    request_id TEXT,
    source_ip INET,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    before_state JSONB,
    after_state JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE cp.compliance_flags (
    compliance_flag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    flag_code TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_claims_veteran_status ON cp.claims(veteran_id, current_status);
CREATE INDEX idx_claim_status_history_claim_started ON cp.claim_status_history(claim_id, started_at DESC);
CREATE INDEX idx_contentions_claim ON cp.contentions(claim_id);
CREATE INDEX idx_evidence_claim_received ON cp.evidence_items(claim_id, received_date DESC);
CREATE INDEX idx_exams_claim_status ON cp.cp_exams(claim_id, status);
CREATE INDEX idx_rating_decisions_claim_date ON cp.rating_decisions(claim_id, decision_date DESC);
CREATE INDEX idx_rating_issues_decision ON cp.rating_issues(rating_decision_id);
CREATE INDEX idx_comp_awards_veteran_start ON cp.compensation_awards(veteran_id, start_date DESC);
CREATE INDEX idx_pension_profiles_veteran_effective ON cp.pension_profiles(veteran_id, effective_date DESC);
CREATE INDEX idx_payment_transactions_veteran_date ON cp.payment_transactions(veteran_id, payment_date DESC);
CREATE INDEX idx_appeals_claim_status ON cp.appeals(claim_id, current_status);
CREATE INDEX idx_documents_claim ON cp.documents(claim_id);
CREATE INDEX idx_audit_events_entity_time ON cp.audit_events(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_compliance_flags_entity_status ON cp.compliance_flags(entity_type, entity_id, status);

CREATE OR REPLACE FUNCTION cp.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_veterans_touch
BEFORE UPDATE ON cp.veterans
FOR EACH ROW EXECUTE FUNCTION cp.touch_updated_at();

CREATE TRIGGER trg_claims_touch
BEFORE UPDATE ON cp.claims
FOR EACH ROW EXECUTE FUNCTION cp.touch_updated_at();

CREATE TRIGGER trg_contentions_touch
BEFORE UPDATE ON cp.contentions
FOR EACH ROW EXECUTE FUNCTION cp.touch_updated_at();

CREATE TRIGGER trg_exams_touch
BEFORE UPDATE ON cp.cp_exams
FOR EACH ROW EXECUTE FUNCTION cp.touch_updated_at();

CREATE TRIGGER trg_rating_decisions_touch
BEFORE UPDATE ON cp.rating_decisions
FOR EACH ROW EXECUTE FUNCTION cp.touch_updated_at();

CREATE TRIGGER trg_pension_profiles_touch
BEFORE UPDATE ON cp.pension_profiles
FOR EACH ROW EXECUTE FUNCTION cp.touch_updated_at();

CREATE TRIGGER trg_appeals_touch
BEFORE UPDATE ON cp.appeals
FOR EACH ROW EXECUTE FUNCTION cp.touch_updated_at();

COMMIT;
