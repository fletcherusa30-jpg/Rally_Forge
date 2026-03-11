# ===========================================================
# DEPRECATED — Analyzer.Engine.ps1
# ===========================================================
# DEPRECATION NOTICE:
#   Logic migrated to: engine/core/scanner_core.psm1::Invoke-AnalysisEngine
#   Do not modify. Retained for fallback until validation completes.
#   Migration date: March 9, 2026
# ===========================================================

# COPILOT SYSTEM INSTRUCTIONS — STRS ANALYZER (DO NOT REMOVE)
# - Work ONLY from provided JSON inputs (STR scanner, decision letters, SC list, denied list, service profile).
# - Never fabricate diagnoses, symptoms, medications, or conditions.
# - Never state that a benefit 'will' be granted; only describe potential claims and evidence patterns.
# - Preserve JSON output schema exactly.
# - All reasoning must be explicit, explainable, and logged in meta.parse_warnings when ambiguous.

param(
    [Parameter(Mandatory = $true)]
    [string]$StrScannerJsonPath,

    [Parameter(Mandatory = $true)]
    [string]$DecisionScannerJsonPath,

    [Parameter(Mandatory = $true)]
    [string]$ServiceConnectedJsonPath,

    [Parameter(Mandatory = $false)]
    [string]$DeniedConditionsJsonPath,

    [Parameter(Mandatory = $false)]
    [string]$ServiceProfileJsonPath
)

$ErrorActionPreference = "Stop"

function Load-JsonFile {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    if (-not (Test-Path -LiteralPath $Path)) { return $null }

    $raw = Get-Content -LiteralPath $Path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }

    return ($raw | ConvertFrom-Json)
}

function To-LowerList {
    param($InputObject)

    if ($null -eq $InputObject) { return @() }
    if ($InputObject -is [System.Array]) {
        return @($InputObject | ForEach-Object { $_.ToString().Trim().ToLowerInvariant() } | Where-Object { $_ })
    }

    return @($InputObject.ToString().Trim().ToLowerInvariant())
}

$strs = Load-JsonFile -Path $StrScannerJsonPath
$decision = Load-JsonFile -Path $DecisionScannerJsonPath
$serviceConnected = Load-JsonFile -Path $ServiceConnectedJsonPath
$denied = Load-JsonFile -Path $DeniedConditionsJsonPath
$serviceProfile = Load-JsonFile -Path $ServiceProfileJsonPath

$diagnoses = @($strs.diagnoses)
$symptoms = @($strs.symptoms)
$medications = @($strs.medications)
$treatments = @($strs.treatments)
$procedures = @($strs.procedures)

$analysisIssues = @()
$potentialClaims = @()
$deniedConditionReviews = @()
$parseWarnings = @()

if ($null -eq $strs) {
    $parseWarnings += "STR scanner JSON was missing or unreadable."
}

if ($null -eq $serviceConnected) {
    $parseWarnings += "Service-connected JSON was missing or unreadable."
}

# Deterministic missing-claim detection: diagnosis text not present in SC list
$scNames = @()
if ($serviceConnected -ne $null) {
    if ($serviceConnected.service_connected) {
        $scNames = To-LowerList -InputObject ($serviceConnected.service_connected | ForEach-Object { $_.condition_name })
    } elseif ($serviceConnected.conditions) {
        $scNames = To-LowerList -InputObject ($serviceConnected.conditions | ForEach-Object { $_.condition_name })
    } elseif ($serviceConnected -is [System.Array]) {
        $scNames = To-LowerList -InputObject ($serviceConnected | ForEach-Object { $_.condition_name })
    }
}

foreach ($diag in $diagnoses) {
    $diagText = [string]$diag.text
    if ([string]::IsNullOrWhiteSpace($diagText)) { continue }

    $normalized = $diagText.Trim().ToLowerInvariant()
    $isInSc = $false

    foreach ($sc in $scNames) {
        if ($normalized -like "*$sc*" -or $sc -like "*$normalized*") {
            $isInSc = $true
            break
        }
    }

    if (-not $isInSc) {
        $analysisIssues += [pscustomobject]@{
            type              = "missing_claim"
            related_condition = $diagText
            summary           = "Diagnosis appears in STR evidence but is not found in service-connected list."
            evidence_refs     = @($diag.line_index)
        }
    }
}

# Deterministic denied-condition review scaffolding
if ($denied -ne $null) {
    $deniedItems = @()

    if ($denied.denied_conditions) {
        $deniedItems = @($denied.denied_conditions)
    } elseif ($denied -is [System.Array]) {
        $deniedItems = @($denied)
    }

    foreach ($item in $deniedItems) {
        $name = [string]$item.condition_name
        if ([string]::IsNullOrWhiteSpace($name)) { continue }

        $nameLower = $name.Trim().ToLowerInvariant()
        $supportCount = @($diagnoses | Where-Object { ([string]$_.text).ToLowerInvariant() -like "*$nameLower*" }).Count

        $supportLevel = "none"
        if ($supportCount -ge 3) { $supportLevel = "strong" }
        elseif ($supportCount -eq 2) { $supportLevel = "moderate" }
        elseif ($supportCount -eq 1) { $supportLevel = "weak" }

        $deniedConditionReviews += [pscustomobject]@{
            condition_name     = $name
            STR_support_level  = $supportLevel
            chronicity_present = ($supportCount -ge 2)
            continuity_present = $false
            advisory_notes     = "Informational only. Deterministic evidence count based on STR diagnoses."
        }
    }
}

# Preserve required schema
$result = [ordered]@{
    diagnoses                = $diagnoses
    symptoms                 = $symptoms
    medications              = $medications
    treatments               = $treatments
    procedures               = $procedures
    analysis_issues          = $analysisIssues
    potential_claims         = $potentialClaims
    denied_condition_reviews = $deniedConditionReviews
    meta                     = @{
        source_type    = "strs_analyzer"
        parse_warnings = $parseWarnings
    }
}

$result | ConvertTo-Json -Depth 10

