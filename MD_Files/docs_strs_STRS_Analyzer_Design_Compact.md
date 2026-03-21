# STRS Analyzer Design

## Overview
Deterministic extractor + AI reasoning layer. Scanner remains deterministic; AI lives in analyzer.

## Inputs
- STR scanner JSON
- Service-connected conditions list
- Denied conditions list
- Decision letter JSON
- Service profile

## Extraction Requirements
Diagnoses, Symptoms, Medications, Treatments, Procedures, Dates, Body system mapping, Chronicity, Continuity.

## Regex Library (Reference)
Diagnoses: diagnosis|dx[: ]|assessment|impression|evaluation|finding|ICD[- ]?\d+
Symptoms: complaint|symptom|c/o|reports|states|presents with|noted|describes
Medications: Rx[: ]|prescribed|medication|mg|tablet|capsule|dose|BID|TID|QID|q\d+h
Procedures: procedure|surgery|operation|MRI|CT|x[- ]?ray|ultrasound|profile|limited duty|LOD
Dates: (Month \d{1,2}, \d{4})|(\d{1,2}/\d{1,2}/\d{2,4})|(\d{4}-\d{2}-\d{2})

## Output Schema
diagnoses[], symptoms[], medications[], treatments[], procedures[], analysis_issues[], potential_claims[], denied_condition_reviews[], meta{source_type, parse_warnings}
