<# DEPRECATED — modules/Parser.psm1
===========================================================
 DEPRECATION NOTICE:
   Logic migrated to: engine/parsers/text_parser.psm1
   Do not modify. Retained for fallback until validation completes.
   Migration date: March 9, 2026
===========================================================
#>

<# Parser.psm1
STRS Parser Module - Handles text parsing and medical record normalization.
Extracts sections, dates, providers, and structure from Service Treatment Records.
#>

function Invoke-StrsParser {
    param([string]$Text)
    
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return @{ status = "error"; module = "Parser.psm1"; error = "Empty text input" }
    }

    $lines = $Text -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $lineCount = $lines.Count

    # Extract dates from text (MM/DD/YYYY, DD MMM YYYY, etc.)
    $dates = @()
    $datePattern = '\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\b'
    foreach ($line in $lines) {
        if ($line -match $datePattern) {
            $dates += $Matches[0]
        }
    }

    # Extract encounter sections (SOAP notes, visit summaries)
    $encounters = @()
    $sectionPattern = '(?i)(SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN|CHIEF\s+COMPLAINT|HISTORY|EXAM|IMPRESSION|DIAGNOSIS)'
    $currentSection = $null
    $sectionContent = @()
    
    foreach ($line in $lines) {
        if ($line -match "^\s*$sectionPattern\s*:?\s*$") {
            if ($currentSection) {
                $encounters += @{
                    section = $currentSection
                    content = ($sectionContent -join ' ')
                    lineCount = $sectionContent.Count
                }
            }
            $currentSection = $Matches[1]
            $sectionContent = @()
        } elseif ($currentSection) {
            $sectionContent += $line.Trim()
        }
    }
    if ($currentSection -and $sectionContent.Count -gt 0) {
        $encounters += @{
            section = $currentSection
            content = ($sectionContent -join ' ')
            lineCount = $sectionContent.Count
        }
    }

    # Extract provider names (Dr., MD, DO, NP, PA)
    $providers = @()
    $providerPattern = '(?i)\b(Dr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[A-Z][a-z]+\s+[A-Z][a-z]+,?\s+(?:MD|DO|NP|PA|RN))\b'
    foreach ($line in $lines) {
        if ($line -match $providerPattern) {
            $provider = $Matches[0] -replace ',\s*$', ''
            if ($providers -notcontains $provider) {
                $providers += $provider
            }
        }
    }

    # Extract vital signs sections
    $vitals = @()
    $vitalPattern = '(?i)(BP|Blood\s+Pressure|Heart\s+Rate|Temp|Weight|Height|BMI)\s*:?\s*([\d/]+)'
    foreach ($line in $lines) {
        if ($line -match $vitalPattern) {
            $vitals += @{
                type = $Matches[1]
                value = $Matches[2]
            }
        }
    }

    return @{
        status = "parsed"
        module = "Parser.psm1"
        lineCount = $lineCount
        dates = $dates
        encounters = $encounters
        providers = $providers
        vitals = $vitals
        rawText = $Text
        sections = $encounters.Count
    }
}

Export-ModuleMember -Function Invoke-StrsParser
