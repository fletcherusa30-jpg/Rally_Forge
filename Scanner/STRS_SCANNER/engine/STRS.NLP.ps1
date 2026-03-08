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
# 3. INTELLIGENCE LAYER
# ------------------------------------------------------------

# 3.1 CHRONICITY
#   - If a diagnosis or complaint appears 2+ times → chronicity = true.

# 3.2 CONTINUITY
#   - If symptoms appear across multiple years → continuity = true.

# 3.3 SERVICE CONNECTION OPPORTUNITIES
#   - Direct: condition + in-service event
#   - Secondary: condition + related primary condition
#   - Aggravation: pre-existing condition worsened in service
#   - Presumptive: Gulf War, AO, burn pits, radiation, etc.
#   - Chronic disease: matches 38 CFR 3.309(a)

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

function Invoke-STRSNLP {
    param(
        [string]$Text,
        [hashtable]$Extracted
    )

    $nlp = @{}

    # --- 1. Symptom Clustering ---
    $symptomPatterns = @{
        "Pain"        = "pain|ache|tender|sore"
        "Mobility"    = "limited range|reduced mobility|difficulty walking|gait"
        "Mental"      = "anxiety|depression|nightmares|flashbacks|hypervigilance"
        "Sleep"       = "insomnia|sleep disturbance|difficulty sleeping"
        "Neuro"       = "numbness|tingling|radiculopathy|neuropathy"
        "GI"          = "nausea|vomiting|diarrhea|abdominal pain"
    }

    $clusters = @{}
    foreach ($key in $symptomPatterns.Keys) {
        $matches = [regex]::Matches($Text, $symptomPatterns[$key], "IgnoreCase")
        if ($matches.Count -gt 0) {
            $clusters[$key] = $matches.Value
        }
    }
    $nlp["SymptomClusters"] = $clusters

    # --- 2. Chronicity Scoring ---
    $chronicTerms = "chronic|persistent|ongoing|recurrent|longstanding|years"
    $chronicMatches = [regex]::Matches($Text, $chronicTerms, "IgnoreCase")
    $nlp["ChronicityScore"] = $chronicMatches.Count

    # --- 3. Nexus Indicators ---
    $nexusTerms = @(
        "due to",
        "secondary to",
        "related to",
        "service connected",
        "as a result of",
        "caused by",
        "military",
        "deployment",
        "in service"
    )

    $nexusHits = @()
    foreach ($term in $nexusTerms) {
        $m = [regex]::Matches($Text, $term, "IgnoreCase")
        if ($m.Count -gt 0) {
            $nexusHits += $term
        }
    }
    $nlp["NexusIndicators"] = $nexusHits

    # --- 4. Exposure Mapping ---
    $exposures = @{
        "Burn Pits"     = "burn pit|burn-pit|airborne hazard"
        "Noise"         = "loud noise|acoustic trauma|hearing loss|tinnitus"
        "Chemical"      = "chemical|solvent|fuel|JP-8|hazmat"
        "Blast"         = "blast|IED|explosion|concussive"
        "Environmental" = "sand|dust|heat|cold|environmental exposure"
    }

    $exposureHits = @{}
    foreach ($key in $exposures.Keys) {
        $m = [regex]::Matches($Text, $exposures[$key], "IgnoreCase")
        if ($m.Count -gt 0) {
            $exposureHits[$key] = $m.Value
        }
    }
    $nlp["ExposureMap"] = $exposureHits

    # --- 5. MOS-Linked Inference ---
    $mosMap = @{
        "11B" = "orthopedic injuries|hearing loss|tinnitus|PTSD"
        "68W" = "back pain|knee pain|shoulder pain|stress disorders"
        "88M" = "back pain|neck pain|joint degeneration"
        "12B" = "blast injuries|hearing loss|TBI"
        "19D" = "spine compression|joint degeneration|hearing loss"
    }

    $mosMatches = [regex]::Match($Text, "\b\d{2}[A-Z]\b")
    if ($mosMatches.Success) {
        $mos = $mosMatches.Value
        if ($mosMap.ContainsKey($mos)) {
            $nlp["MOS"] = $mos
            $nlp["MOSLinkedConditions"] = $mosMap[$mos]
        }
    }

    # --- 6. Temporal Sequencing ---
    $dates = [regex]::Matches($Text, "\b\d{1,2}/\d{1,2}/\d{2,4}\b")
    $nlp["Timeline"] = $dates.Value

    # --- 7. Severity Indicators ---
    $severityTerms = "severe|significant|marked|pronounced|debilitating|incapacitating"
    $severityMatches = [regex]::Matches($Text, $severityTerms, "IgnoreCase")
    $nlp["SeverityScore"] = $severityMatches.Count

    return $nlp
}

