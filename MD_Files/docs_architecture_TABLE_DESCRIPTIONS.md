# TABLE DESCRIPTIONS

## Table-by-Table Structure Description

### veterans
Core demographic and identity record for each veteran.  
**Fields:** veteran_id (PK, UUID), va_file_number, first_name, middle_name, last_name, suffix, date_of_birth, date_of_death, sex_at_birth, timestamps.

### veteran_identifiers
Alternative identifiers (SSN, EDIPI, ICN, etc.) with temporal validity.  
**Fields:** identifier_id (PK, UUID), veteran_id (FK), identifier_type, identifier_value, issuer, effective_from, effective_to, is_primary, timestamps.

### service_periods
Military service history with deployment metadata.  
**Fields:** service_period_id (PK, UUID), veteran_id (FK), branch, service_component, start_date, end_date, characterization, pay_grade, theater, deployed, timestamps.

### contacts
Phone, email, and other contact methods.  
**Fields:** contact_id (PK, UUID), veteran_id (FK), contact_type, value, is_primary, verified_at, timestamps.

### addresses
Mailing, residential, and forwarding addresses with temporal validity.  
**Fields:** address_id (PK, UUID), veteran_id (FK), address_type, line1, line2, city, state_province, postal_code, country_code, valid_from, valid_to, is_primary, timestamps.

### representatives
Registry of accredited VSOs, attorneys, and agents.  
**Fields:** representative_id (PK, UUID), representative_type, organization_name, first_name, last_name, accreditation_number, phone, email, timestamps.

### veteran_representatives
Link between veteran and active representatives with POA metadata.  
**Fields:** veteran_representative_id (PK, UUID), veteran_id (FK), representative_id (FK), poa_form_code, effective_from, effective_to, is_active, timestamps.

### claims
Central lifecycle record for disability compensation, pension, and dependency claims.  
**Fields:** claim_id (PK, UUID), veteran_id (FK), claim_number, program (enum), claim_type (enum), source_channel, date_received, date_established, current_status (enum), station_of_jurisdiction, end_product_code, suspense_date, timestamps.

### claim_status_history
Immutable event log of claim lifecycle transitions.  
**Fields:** claim_status_history_id (PK, UUID), claim_id (FK), status (enum), started_at, ended_at, changed_by, reason, timestamps.

### contentions
Individual issues (conditions) claimed within a larger claim.  
**Fields:** contention_id (PK, UUID), claim_id (FK), contention_code, contention_name, contention_type (enum), body_system, is_bilateral, side, diagnostic_code, date_claimed, timestamps.

### evidence_items
Medical records, DBQs, lay statements, and forms submitted in support of contentions.  
**Fields:** evidence_id (PK, UUID), claim_id (FK), evidence_type (enum), title, source, received_date, document_date, is_material, relevance_score, metadata (JSONB), timestamps.

### contention_evidence
Many-to-many relationship mapping evidence to specific contentions.  
**Fields:** contention_evidence_id (PK, UUID), contention_id (FK), evidence_id (FK), relation_type, timestamps.

### cp_exams
Compensation and Pension examinations ordered, scheduled, and completed.  
**Fields:** exam_id (PK, UUID), claim_id (FK), contention_id (FK), exam_type, vendor_name, facility_name, request_date, scheduled_date, completed_date, examiner_name, examiner_specialty, status (enum), dbq_form_code, timestamps.

### exam_findings
Individual observations and measurements recorded during exams.  
**Fields:** exam_finding_id (PK, UUID), exam_id (FK), finding_code, finding_name, value_text, value_numeric, value_unit, is_positive, rationale, timestamps.

### rating_decisions
Adjudication outcome documents (rating decision, HLR, supplemental, board decision).  
**Fields:** rating_decision_id (PK, UUID), claim_id (FK), decision_type (enum), decision_date, notification_date, promulgation_date, signed_by, quality_review_flag, narrative_document_id (FK), notes, timestamps.

### rating_issues
Adjudicated outcomes for specific contentions with disposition, percentage, effective date, and denial rationale.  
**Fields:** rating_issue_id (PK, UUID), rating_decision_id (FK), contention_id (FK), issue_name, disposition (enum), service_connected, diagnostic_code, percentage_assigned, effective_date, bilateral_factor_applied, denial_reason_text, rationale_text, timestamps.

### decision_citations
Legal and regulatory citations supporting a rating issue.  
**Fields:** decision_citation_id (PK, UUID), rating_issue_id (FK), authority_type, citation, authority_title, excerpt, timestamps.

### combined_ratings
Computed overall disability rating from individual service-connected conditions.  
**Fields:** combined_rating_id (PK, UUID), rating_decision_id (FK, unique), computed_combined_percent, stated_combined_percent, bilateral_factor_percent, smc_code, compensation_level, timestamps.

### compensation_awards
Monthly compensation award records with start/end dates and dependent increments.  
**Fields:** compensation_award_id (PK, UUID), veteran_id (FK), rating_decision_id (FK), start_date, end_date, monthly_amount, dependent_increment, smc_amount, withholding_amount, currency_code, timestamps.

### pension_profiles
Income-based pension eligibility and configuration profiles.  
**Fields:** pension_profile_id (PK, UUID), veteran_id (FK), pension_type, mapr_category, aid_and_attendance, housebound, dependent_count, effective_date, end_date, timestamps.

### pension_income_sources
Countable and non-countable income streams for pension means testing.  
**Fields:** pension_income_source_id (PK, UUID), pension_profile_id (FK), income_type, payer_name, frequency, gross_amount, countable_percent, effective_from, effective_to, timestamps.

### pension_assets
Net-worth components (real estate, investments, cash) for pension eligibility.  
**Fields:** pension_asset_id (PK, UUID), pension_profile_id (FK), asset_type, description, fair_market_value, encumbrance_amount, ownership_percent, as_of_date, timestamps.

### pension_deductions
Medical and unreimbursed expense deductions reducing countable income.  
**Fields:** pension_deduction_id (PK, UUID), pension_profile_id (FK), deduction_type, annual_amount, effective_from, effective_to, timestamps.

### pension_awards
Computed annual and monthly pension amounts based on MAPR, countable income, and net worth.  
**Fields:** pension_award_id (PK, UUID), pension_profile_id (FK), decision_date, mapr_amount, countable_income, net_worth_amount, annual_pension_amount, monthly_pension_amount, timestamps.

### payment_accounts
Bank account and payment destination information.  
**Fields:** payment_account_id (PK, UUID), veteran_id (FK), account_type, institution_name, routing_last4, account_last4, active, start_date, end_date, timestamps.

### payment_transactions
Individual payment disbursements and recoupments.  
**Fields:** payment_transaction_id (PK, UUID), veteran_id (FK), claim_id (FK), payment_account_id (FK), payment_type (enum), payment_date, posted_at, amount, currency_code, reference_number, treasury_trace, status, timestamps.

### overpayment_debts
Debt records for overpayments requiring recoupment or waiver.  
**Fields:** overpayment_debt_id (PK, UUID), veteran_id (FK), originating_claim_id (FK), debt_reason, principal_amount, interest_amount, balance_amount, established_date, waived, timestamps.

### appeals
Appeals filed in response to rating decisions (NOD, HLR, supplemental, board).  
**Fields:** appeal_id (PK, UUID), claim_id (FK), rating_decision_id (FK), lane (enum), docket_number, date_received, current_status (enum), disposition_date, disposition_summary, timestamps.

### appeal_issues
Individual issues included in an appeal with Board disposition.  
**Fields:** appeal_issue_id (PK, UUID), appeal_id (FK), rating_issue_id (FK), issue_name, sought_outcome, board_disposition (enum), remand_reason, timestamps.

### hearings
DRO, Board virtual, travel, and video hearings with transcripts.  
**Fields:** hearing_id (PK, UUID), appeal_id (FK), hearing_type (enum), scheduled_at, held_at, location, presiding_official, transcript_document_id (FK), outcome_notes, timestamps.

### documents
File metadata for rating narratives, DBQs, transcripts, and uploaded evidence.  
**Fields:** document_id (PK, UUID), veteran_id (FK), claim_id (FK), document_type, source (enum), source_reference, checksum_sha256, storage_uri, mime_type, page_count, received_at, indexed_at, metadata (JSONB), timestamps.

### authority_citations
Canonical registry of 38 CFR and M21-1 citations used in decisions.  
**Fields:** authority_citation_id (PK, UUID), citation (unique), title, authority_system, part, section, subsection, canonical_url, metadata (JSONB), timestamps.

### issue_authority_map
Many-to-many link between rating issues and normalized authority citations with strength scoring.  
**Fields:** issue_authority_map_id (PK, UUID), rating_issue_id (FK), authority_citation_id (FK), relation_strength, timestamps.

### audit_events
Immutable append-only event log for CRUD operations with before/after snapshots.  
**Fields:** audit_event_id (PK, UUID), actor_type (enum), actor_id, event_name, entity_type, entity_id, request_id, source_ip, occurred_at, before_state (JSONB), after_state (JSONB), metadata (JSONB).

### compliance_flags
Quality assurance and compliance signals (review triggers, anomalies, policy violations).  
**Fields:** compliance_flag_id (PK, UUID), entity_type, entity_id, flag_code, severity, status, detected_at, resolved_at, resolution_notes, metadata (JSONB).
