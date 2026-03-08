# ============================================================
# COPILOT SYSTEM INSTRUCTIONS — STRS_SCANNER FOLDER
# ============================================================
# You are maintaining the Rally Forge STR Scanner located in:
#   C:\Dev\Rally Forge\STRS_SCANNER
#
# Your job is to review, maintain, and implement ALL logic in this
# folder to ensure 100% accurate extraction of STR medical evidence.
#
# You MUST follow these rules at all times:

# ------------------------------------------------------------
# 1. GENERAL BEHAVIOR
# ------------------------------------------------------------
# - Review ALL files in this folder before making changes.
# - Maintain deterministic, rule-based parsing only.
# - Never infer, guess, or hallucinate diagnoses, complaints,
#   medications, or events.
# - Never remove or weaken existing logic.
# - All changes must be additive, reversible, and logged in comments.
# - Never change the JSON output structure.

# ------------------------------------------------------------
# 2. REQUIRED EXTRACTION TARGETS
# ------------------------------------------------------------
# You MUST extract the following from STR text:

# 2.1 DIAGNOSES
#   - diagnosis, dx, assessment, impression, evaluation, finding,
#     ICD codes, chronic conditions, medical assessments.
#   - Regex anchors you MUST preserve:
#       diagnosis|dx|assessment|impression|evaluation|finding|ICD

# 2.2 COMPLAINTS / SYMPTOMS
#   - complaint, symptom, reports, states, presents with, c/o.
#   - Regex anchors you MUST preserve:
#       complaint|symptom|reports|states|presents with|c/o

# 2.3 MEDICATIONS
#   - Generic names, brand names, prescriptions, dosages.
#   - Regex anchors you MUST preserve:
#       Rx|prescribed|medication|mg|tablet|capsule|dose|BID|TID|QID

# 2.4 PROCEDURES / TREATMENTS
#   - surgery, operation, MRI, CT, x-ray, profile, limited duty,
#     LOD events, referrals, physical therapy.

# 2.5 DATES
#   - Every extracted item MUST be paired with the nearest date.
#   - Regex anchors you MUST preserve:
#       (Month \d{1,2}, \d{4})|(\d{1,2}/\d{1,2}/\d{2,4})|(\d{4}-\d{2}-\d{2})

# ------------------------------------------------------------
# 3. INTELLIGENCE LAYER - UPGRADED 2026
# COPILOT CHANGE: Enhanced extraction criteria for improved evidence detection
# ------------------------------------------------------------

# 3.1 CHRONICITY DETECTION (CRITICAL)
#   - If a diagnosis or complaint appears 2+ times across different visits → chronicity = true
#   - Track frequency and date span
#   - Essential for proving 38 CFR 3.309(a) chronic disease claims

# 3.2 CONTINUITY DETECTION (CRITICAL)
#   - If symptoms appear across multiple YEARS → continuity = true
#   - Document each year of evidence
#   - Essential for secondary and presumptive claims

# 3.3 SERVICE CONNECTION PATTERNS (CRITICAL)
#   - Direct: condition + documented in-service event/exposure
#   - Secondary: condition + documented relationship to primary SC condition
#   - Aggravation: pre-service condition documented worse during/after service
#   - Presumptive: condition + verified exposure (Gulf War, AO, burn pits, radiation)
#   - Increase: worsening of existing SC condition

# 3.4 FUNCTIONAL IMPACT ASSESSMENT (UPGRADED)
#   - Track severity descriptors (severe, moderate, mild, chronic)
#   - Document functional limitations (unable to, restricts, prevents)
#   - Identify compensable impact for rating purposes

# 3.5 NEXUS INDICATORS (UPGRADED)
#   - Temporal relationship: condition onset during/after service
#   - Causal relationship: documented link between service and condition
#   - Evidence chain: medical documentation explaining mechanism

# ------------------------------------------------------------
# 4. JSON OUTPUT RULES
# ------------------------------------------------------------
# The output MUST ALWAYS include:

# {
#   "conditions": [],
#   "complaints": [],
#   "medications": [],
#   "treatments": [],
#   "procedures": [],
#   "service_connection_opportunities": [],
#   "parse_warnings": []
# }

# - Do NOT rename, remove, or restructure fields.
# - Only add new optional fields if needed.
# - Always return valid JSON even on partial failure.

# ------------------------------------------------------------
# 5. FUNCTION SAFETY RULES
# ------------------------------------------------------------
# - Do NOT remove or rewrite core functions.
# - You may extend functions, but logic must remain deterministic.
# - All regex blocks must remain intact; you may add new patterns.
# - All changes must be logged in comments with:
#       # COPILOT CHANGE: <description>

# ------------------------------------------------------------
# 6. FOLDER-WIDE RESPONSIBILITY
# ------------------------------------------------------------
# You MUST:
# - Review every file in C:\Dev\Rally Forge\STRS_SCANNER
# - Ensure all modules follow these rules
# - Ensure all scanners produce consistent JSON
# - Ensure all extraction logic is complete and compliant
# - Ensure no file violates schema or logic requirements

# ============================================================
# END OF COPILOT SYSTEM INSTRUCTIONS
# ============================================================

. "$PSScriptRoot\STRS.Utils.ps1"

function Invoke-STRSExtraction {
    param([string]$Text)

    $diagnosisKeywords = @(
        'diagnosis', 'dx', 'assessment', 'impression', 'evaluation', 'finding', 'icd'
    )
    $symptomKeywords = @(
        'complaint', 'symptom', 'reports', 'states', 'presents with', 'c/o'
    )
    $eventKeywords = @(
        'event', 'injury', 'injured', 'incident', 'accident', 'trauma', 'line of duty', 'lod', 'fall', 'blast'
    )

    $diagnoses = Select-STRSKeywordMatches -Text $Text -Category 'diagnosis' -Keywords $diagnosisKeywords
    $symptoms = Select-STRSKeywordMatches -Text $Text -Category 'symptoms' -Keywords $symptomKeywords
    $events = Select-STRSKeywordMatches -Text $Text -Category 'events' -Keywords $eventKeywords

    $pageNumbers = Get-STRSPageMarkers -Text $Text
    $dates = Get-STRSDateMatches -Text $Text

    return (New-STRSStructuredOutput -Diagnoses $diagnoses -Symptoms $symptoms -Events $events -PageNumbers $pageNumbers -Dates $dates)
}

