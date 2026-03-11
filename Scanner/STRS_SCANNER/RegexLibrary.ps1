# ===========================================================
# DEPRECATED — RegexLibrary.ps1
# ===========================================================
# DEPRECATION NOTICE:
#   Logic migrated to: engine/rules/strs_rules.psm1
#   Do not modify. Retained for fallback until validation completes.
#   Migration date: March 9, 2026
#   All regex patterns now in strs_rules.psm1
# ===========================================================

# Regex Library for STRS Scanner (Deterministic) - UPGRADED 2026
# COPILOT CHANGE: Expanded patterns to capture more medical evidence

# Diagnoses: formal dx, assessments, impressions, ICD codes, findings
$RegexDiagnosis = 'diagnosis|dx[: ]|assessment|impression|evaluation|finding|ICD[- ]?\d+|diagnosed with|condition|injury'

# Symptoms: complaints and reported symptoms, pain levels, functional limitations
$RegexSymptoms = 'complaint|symptom|c/o|reports|states|presents with|noted|describes|pain|ache|difficulty|trouble|unable to|can.?t|unable|limitation'

# Medications: prescriptions, dosing patterns, frequencies, strengths
$RegexMedications = 'Rx[: ]|prescribed|medication|mg|tablet|capsule|dose|BID|TID|QID|q\d+h|once daily|twice daily|three times|frequency|strength|formulation'

# Procedures: surgeries, imaging, treatments, therapies, LOD events
$RegexProcedures = 'procedure|surgery|operation|surgical|operative|MRI|CT|x[- ]?ray|ultrasound|imaging|scan|profile|limited duty|LOD|therapy|physical therapy|PT|injection|biopsy|endoscopy'

# Dates: common date formats including word months
$RegexDates = '(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|(\d{1,2}/\d{1,2}/\d{2,4})|(\d{4}-\d{2}-\d{2})'

# COPILOT CHANGE: Added service connection keywords
$RegexServiceConnection = 'service connected|in service|during service|incident|exposure|combat|deployment'

# COPILOT CHANGE: Added chronicity indicators
$RegexChronicity = 'chronic|ongoing|recurrent|persistent|recurring|long.?standing|for years|for months|continued|worsens'

# COPILOT CHANGE: Added severity/functional impact
$RegexSeverity = 'severe|moderate|mild|limiting|functional impairment|disability|unable|prevents|restricts|interferes'
