# COPILOT SYSTEM INSTRUCTIONS — STRS SCANNER (DO NOT REMOVE)
# - Deterministic, regex-based extraction only.
# - No AI, no inference, no hallucination.
# - Preserve patterns and JSON shape.
# - Only extend logic; do not remove fields or functions.

param(
    [Parameter(Mandatory = $true)]
    [string]$Text
)

. "$PSScriptRoot\RegexLibrary.ps1"

# Split into lines
$lines = $Text -split "`r?`n"

function Get-DateRegex {
    return '\b(?:\d{1,2}/\d{1,2}/\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\b'
}

function Get-PageRegex {
    return '\b(?:Page|Pg\.?)\s*(\d{1,4})\b'
}

function Get-PageMarkers {
    $results = @()
    $pattern = Get-PageRegex

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

function Get-NearestPageNumber {
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

function Get-DateValuesFromLine {
    param([string]$Line)

    $pattern = Get-DateRegex
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

function Get-DateMatches {
    $results = @()
    $seen = @{}
    $pattern = Get-DateRegex

    foreach ($match in [regex]::Matches($Text, $pattern, 'IgnoreCase')) {
        $value = $match.Value.Trim()
        if ([string]::IsNullOrWhiteSpace($value)) { continue }
        if ($seen.ContainsKey($value.ToLowerInvariant())) { continue }

        $results += [pscustomobject]@{
            value = $value
            index = $match.Index
        }
        $seen[$value.ToLowerInvariant()] = $true
    }

    return $results
}

function Get-KeywordMatches {
    param(
        [string]$Category,
        [string[]]$Keywords
    )

    $escaped = @($Keywords | ForEach-Object { [regex]::Escape($_) })
    $pattern = "\b(?:$($escaped -join '|'))\b"
    $pageMarkers = Get-PageMarkers

    $results = @()
    for ($index = 0; $index -lt $lines.Count; $index++) {
        $line = $lines[$index]
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        $lineMatches = [regex]::Matches($line, $pattern, 'IgnoreCase')
        if ($lineMatches.Count -gt 0) {
            $lineDates = Get-DateValuesFromLine -Line $line
            $pageNumber = Get-NearestPageNumber -LineIndex $index -PageMarkers $pageMarkers

            foreach ($match in $lineMatches) {
            $results += [pscustomobject]@{
                category   = $Category
                keyword    = $match.Value
                line_index = $index
                text       = $line.Trim()
                page_number = $pageNumber
                dates      = @($lineDates)
            }
            }
        }
    }

    return $results
}

function New-StructuredOutput {
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
        diagnoses    = $diagnosesOut
        symptoms     = $symptomsOut
        events       = $eventsOut
        page_numbers = $pagesOut
        dates        = $datesOut
        meta         = @{
            source_type    = "strs_scanner"
            parse_warnings = @()
        }
    }
}

$diagnosisKeywords = @('diagnosis', 'dx', 'assessment', 'impression', 'evaluation', 'finding', 'icd')
$symptomKeywords = @('complaint', 'symptom', 'reports', 'states', 'presents with', 'c/o')
$eventKeywords = @('event', 'injury', 'injured', 'incident', 'accident', 'trauma', 'line of duty', 'lod', 'fall', 'blast')

$diagnoses = Get-KeywordMatches -Category 'diagnosis' -Keywords $diagnosisKeywords
$symptoms = Get-KeywordMatches -Category 'symptoms' -Keywords $symptomKeywords
$events = Get-KeywordMatches -Category 'events' -Keywords $eventKeywords
$pageNumbers = Get-PageMarkers
$dates = Get-DateMatches

$output = New-StructuredOutput -Diagnoses $diagnoses -Symptoms $symptoms -Events $events -PageNumbers $pageNumbers -Dates $dates

$output | ConvertTo-Json -Depth 6

