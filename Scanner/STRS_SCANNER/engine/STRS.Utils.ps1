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

function Get-STRSModelsPath {
    return (Join-Path $PSScriptRoot "..\models")
}

function Read-STRSJsonModel {
    param([string]$FileName)
    $path = Join-Path (Get-STRSModelsPath) $FileName
    if (-not (Test-Path $path)) { return @() }
    try { return (Get-Content -Path $path -Raw | ConvertFrom-Json) }
    catch { return @() }
}

function Select-STRSMatches {
    param([string]$Text, [string]$PatternFile)
    $patterns = Read-STRSJsonModel -FileName "$PatternFile.json"
    $results = @()
    foreach ($p in $patterns) {
        if (-not $p.Pattern) { continue }
        $regexMatches = [regex]::Matches($Text, $p.Pattern, "IgnoreCase")
        foreach ($m in $regexMatches) {
            $results += [pscustomobject]@{
                Label   = $p.Label
                Pattern = $p.Pattern
                Match   = $m.Value
                Index   = $m.Index
            }
        }
    }
    return $results
}

function Select-STRSEncounters {
    param([string]$Text)
    $lines = $Text -split "`n"
    $encounters = @()
    $current = @()

    foreach ($line in $lines) {
        if ($line -match '^\s*\d{1,2}/\d{1,2}/\d{2,4}') {
            if ($current.Count -gt 0) {
                $encounters += ($current -join "`n")
                $current = @()
            }
        }
        $current += $line
    }

    if ($current.Count -gt 0) {
        $encounters += ($current -join "`n")
    }

    $out = @()
    $i = 0
    foreach ($enc in $encounters) {
        $i++
        $out += [pscustomobject]@{
            Id      = $i
            Content = $enc
        }
    }
    return $out
}

function Get-STRSDateRegex {
    return '\b(?:\d{1,2}/\d{1,2}/\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\b'
}

function Get-STRSPageRegex {
    return '\b(?:Page|Pg\.?)\s*(\d{1,4})\b'
}

function Get-STRSDateMatches {
    param([string]$Text)

    $pattern = Get-STRSDateRegex
    $seen = @{}
    $results = @()

    foreach ($match in [regex]::Matches($Text, $pattern, 'IgnoreCase')) {
        $value = $match.Value.Trim()
        if ([string]::IsNullOrWhiteSpace($value)) { continue }
        if ($seen.ContainsKey($value.ToLowerInvariant())) { continue }

        $results += [pscustomobject]@{
            Value = $value
            Index = $match.Index
        }
        $seen[$value.ToLowerInvariant()] = $true
    }

    return $results
}

function Get-STRSPageMarkers {
    param([string]$Text)

    $lines = $Text -split "`n"
    $pattern = Get-STRSPageRegex
    $results = @()

    for ($index = 0; $index -lt $lines.Count; $index++) {
        $line = [string]$lines[$index]
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        $match = [regex]::Match($line, $pattern, 'IgnoreCase')
        if (-not $match.Success) { continue }

        $pageNumber = 0
        [void][int]::TryParse($match.Groups[1].Value, [ref]$pageNumber)
        if ($pageNumber -le 0) { continue }

        $results += [pscustomobject]@{
            line_index = $index
            page_number = $pageNumber
            text = $line.Trim()
        }
    }

    return $results
}

function Get-STRSNearestPageNumber {
    param(
        [int]$LineIndex,
        [array]$PageMarkers
    )

    if ($null -eq $PageMarkers -or $PageMarkers.Count -eq 0) { return $null }

    $previous = @($PageMarkers | Where-Object { $_.line_index -le $LineIndex } | Sort-Object line_index)
    if ($previous.Count -gt 0) {
        return $previous[-1].page_number
    }

    return $PageMarkers[0].page_number
}

function Get-STRSDatesFromLine {
    param([string]$Line)

    if ([string]::IsNullOrWhiteSpace($Line)) { return @() }

    $pattern = Get-STRSDateRegex
    $seen = @{}
    $values = @()

    foreach ($match in [regex]::Matches($Line, $pattern, 'IgnoreCase')) {
        $value = $match.Value.Trim()
        if ([string]::IsNullOrWhiteSpace($value)) { continue }
        if ($seen.ContainsKey($value.ToLowerInvariant())) { continue }

        $values += $value
        $seen[$value.ToLowerInvariant()] = $true
    }

    return $values
}

function Select-STRSKeywordMatches {
    param(
        [string]$Text,
        [string]$Category,
        [string[]]$Keywords
    )

    if ($null -eq $Keywords -or $Keywords.Count -eq 0) { return @() }

    $escaped = @($Keywords | ForEach-Object { [regex]::Escape($_) })
    $pattern = "\b(?:$($escaped -join '|'))\b"
    $pageMarkers = Get-STRSPageMarkers -Text $Text
    $lines = $Text -split "`n"

    $results = @()
    for ($index = 0; $index -lt $lines.Count; $index++) {
        $line = [string]$lines[$index]
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        $lineMatches = [regex]::Matches($line, $pattern, 'IgnoreCase')
        if ($lineMatches.Count -eq 0) { continue }

        $lineDates = Get-STRSDatesFromLine -Line $line
        $pageNumber = Get-STRSNearestPageNumber -LineIndex $index -PageMarkers $pageMarkers

        foreach ($m in $lineMatches) {
            $results += [pscustomobject]@{
                category = $Category
                keyword = $m.Value
                line_index = $index
                text = $line.Trim()
                page_number = $pageNumber
                dates = @($lineDates)
            }
        }
    }

    return $results
}

function New-STRSStructuredOutput {
    param(
        [array]$Diagnoses,
        [array]$Symptoms,
        [array]$Events,
        [array]$PageNumbers,
        [array]$Dates
    )

    $diagnosesOut = if ($null -eq $Diagnoses) { @() } else { @($Diagnoses) }
    $symptomsOut = if ($null -eq $Symptoms) { @() } else { @($Symptoms) }
    $eventsOut = if ($null -eq $Events) { @() } else { @($Events) }
    $pagesOut = if ($null -eq $PageNumbers) { @() } else { @($PageNumbers) }
    $datesOut = if ($null -eq $Dates) { @() } else { @($Dates) }

    return [ordered]@{
        Diagnoses = $diagnosesOut
        Symptoms = $symptomsOut
        Events = $eventsOut
        PageNumbers = $pagesOut
        Dates = $datesOut
        Labs = @()
        Imaging = @()
        Medications = @()
        Encounters = @()
        Treatments = @()
        Procedures = @()
    }
}

