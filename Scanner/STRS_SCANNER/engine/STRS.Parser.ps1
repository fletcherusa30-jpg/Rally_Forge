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

function Invoke-STRSNormalization {
    param([string]$PdfPath)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "pdftotext"
    $psi.Arguments = "-layout -nopgbrk `"$PdfPath`" -"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $null = $proc.Start()
    $text = $proc.StandardOutput.ReadToEnd()
    $err  = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    if ($proc.ExitCode -ne 0) { throw $err }

    $clean = $text -replace '\s{3,}', ' ' `
                   -replace ' +', ' ' `
                   -replace '\r', '' `
                   -replace '\n{2,}', "`n"

    return $clean
}

