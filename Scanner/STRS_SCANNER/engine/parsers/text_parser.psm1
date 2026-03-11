<#
===========================================================
 text_parser.psm1 — STRS Text Parsing Engine
===========================================================
 Module: engine/parsers/text_parser.psm1
 Purpose: Parse raw STRS text into structured elements
 Created: March 9, 2026 (STRICT REFACTOR MODE consolidation)
 
 Consolidates logic from:
   - STRS.Parser.ps1 (root and engine/)
   - STRS.Scanner.Text.ps1
   - STRS.DateDetector.ps1
   - STRS.PageDetector.ps1
   - engine/STRS.Extractor.ps1
   - modules/Parser.psm1
   - modules/Extractor.psm1
===========================================================
#>

<#
.SYNOPSIS
Main text parsing function

.DESCRIPTION
Parses raw STRS text and extracts:
- Page markers
- Dates
- SOAP sections (Subjective, Objective, Assessment, Plan)
- Provider names
- Vital signs
- Line structure

.PARAMETER Text
Raw text content from STRS document

.OUTPUTS
Hashtable with parsed elements
#>
function Invoke-TextParser {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [string]$Text
    )
    
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return @{
            status = "error"
            error = "Empty text input"
            parse_warnings = @("Text input is null or empty")
        }
    }
    
    # Split into lines, filter out null elements for safe downstream binding
    [string[]]$lines = @($Text -split "`r?`n" | ForEach-Object { if ($null -ne $_) { $_ } else { '' } })
    $lineCount = $lines.Count
    
    # Extract structural elements  
    [array]$pageMarkers = Get-PageMarkers -Lines $lines
    [array]$dates = Get-DateMatches -Text $Text
    [array]$encounters = Get-SOAPSections -Lines $lines
    [array]$providers = Get-ProviderNames -Lines $lines
    [array]$vitals = Get-VitalSigns -Lines $lines
    
    # Build output
    $output = @{
        status = "parsed"
        lines = $lines
        line_count = $lineCount
        page_markers = $pageMarkers
        dates = $dates
        encounters = $encounters
        providers = $providers
        vitals = $vitals
        raw_text = $Text
        parse_warnings = @()
    }
    
    # Add warnings if critical elements missing
    if ($pageMarkers.Count -eq 0) {
        $output.parse_warnings += "No page markers detected"
    }
    
    if ($dates.Count -eq 0) {
        $output.parse_warnings += "No dates detected"
    }
    
    return $output
}

<#
.SYNOPSIS
Extract page markers from text

.DESCRIPTION
Finds all "Page", "Pg", "Pg." markers and their line indices

.PARAMETER Lines
Array of text lines

.OUTPUTS
Array of page marker objects with line_index, page_number, text
#>
function Get-PageMarkers {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [AllowEmptyCollection()]
        [AllowEmptyString()]
        [string[]]$Lines
    )
    
    if ($null -eq $Lines -or $Lines.Count -eq 0) {
        return @()
    }
    
    $results = @()
    $pattern = '\b(?:Page|Pg\.?)\s*(\d{1,4})\b'
    
    for ($index = 0; $index -lt $Lines.Count; $index++) {
        $line = [string]$Lines[$index]
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

<#
.SYNOPSIS
Get nearest page number for a given line index

.DESCRIPTION
Finds the most recent page marker at or before the specified line

.PARAMETER LineIndex
Line index to find page number for

.PARAMETER PageMarkers
Array of page markers from Get-PageMarkers

.OUTPUTS
Integer page number or $null if not found
#>
function Get-NearestPageNumber {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [int]$LineIndex,
        
        [Parameter(Mandatory = $false)]
        [AllowEmptyCollection()]
        [array]$PageMarkers
    )
    
    if ($null -eq $PageMarkers -or $PageMarkers.Count -eq 0) {
        return $null
    }
    
    # Find all page markers at or before this line
    $previous = @($PageMarkers | Where-Object { $_.line_index -le $LineIndex } | Sort-Object line_index)
    
    if ($previous.Count -gt 0) {
        return $previous[-1].page_number
    }
    
    # If no previous markers, use first page marker
    return $PageMarkers[0].page_number
}

<#
.SYNOPSIS
Extract all dates from text

.DESCRIPTION
Finds dates in multiple formats:
- MM/DD/YYYY
- M/D/YY
- Month DD, YYYY
- DD Month YYYY
- YYYY-MM-DD (ISO format)

.PARAMETER Text
Raw text content

.OUTPUTS
Array of date objects with value and index
#>
function Get-DateMatches {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [string]$Text
    )
    
    $results = @()
    $seen = @{}
    
    # Multiple date patterns
    $patterns = @(
        '\b\d{1,2}/\d{1,2}/\d{4}\b',  # MM/DD/YYYY
        '\b\d{1,2}/\d{1,2}/\d{2}\b',   # MM/DD/YY
        '\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',  # Month DD, YYYY
        '\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b',  # DD Mon YYYY
        '\b\d{4}-\d{2}-\d{2}\b'  # YYYY-MM-DD
    )
    
    foreach ($pattern in $patterns) {
        foreach ($match in [regex]::Matches($Text, $pattern, 'IgnoreCase')) {
            $value = $match.Value.Trim()
            if ([string]::IsNullOrWhiteSpace($value)) { continue }
            
            $key = $value.ToLowerInvariant()
            if ($seen.ContainsKey($key)) { continue }
            
            $results += [pscustomobject]@{
                value = $value
                index = $match.Index
            }
            $seen[$key] = $true
        }
    }
    
    return $results
}

<#
.SYNOPSIS
Extract date values from a single line

.DESCRIPTION
Finds all unique dates in a specific line

.PARAMETER Line
Single text line

.OUTPUTS
Array of date strings
#>
function Get-DateValuesFromLine {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [string]$Line
    )
    
    if ([string]::IsNullOrWhiteSpace($Line)) {
        return @()
    }
    
    $patterns = @(
        '\b\d{1,2}/\d{1,2}/\d{4}\b',
        '\b\d{1,2}/\d{1,2}/\d{2}\b',
        '\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
        '\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b',
        '\b\d{4}-\d{2}-\d{2}\b'
    )
    
    $seen = @{}
    $values = @()
    
    foreach ($pattern in $patterns) {
        foreach ($match in [regex]::Matches($Line, $pattern, 'IgnoreCase')) {
            $value = $match.Value.Trim()
            if ([string]::IsNullOrWhiteSpace($value)) { continue }
            
            $key = $value.ToLowerInvariant()
            if ($seen.ContainsKey($key)) { continue }
            
            $values += $value
            $seen[$key] = $true
        }
    }
    
    return $values
}

<#
.SYNOPSIS
Extract SOAP note sections

.DESCRIPTION
Identifies and extracts structured clinical sections:
- Subjective
- Objective
- Assessment
- Plan
- Chief Complaint
- History
- Exam
- Impression
- Diagnosis

.PARAMETER Lines
Array of text lines

.OUTPUTS
Array of encounter section objects
#>
function Get-SOAPSections {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]        [AllowEmptyString()]        [string[]]$Lines
    )
    
    if ($null -eq $Lines -or $Lines.Count -eq 0) {
        return @()
    }
    
    $encounters = @()
    $sectionPattern = '(?i)^\s*(SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN|CHIEF\s+COMPLAINT|HISTORY|EXAM|IMPRESSION|DIAGNOSIS)\s*:?\s*$'
    $currentSection = $null
    $sectionContent = @()
    
    foreach ($line in $Lines) {
        if ($line -match $sectionPattern) {
            # Save previous section if exists
            if ($currentSection) {
                $encounters += @{
                    section = $currentSection
                    content = ($sectionContent -join ' ').Trim()
                    line_count = $sectionContent.Count
                }
            }
            
            # Start new section
            $currentSection = $Matches[1]
            $sectionContent = @()
        }
        elseif ($currentSection) {
            # Add to current section
            if (-not [string]::IsNullOrWhiteSpace($line)) {
                $sectionContent += $line.Trim()
            }
        }
    }
    
    # Save final section
    if ($currentSection -and $sectionContent.Count -gt 0) {
        $encounters += @{
            section = $currentSection
            content = ($sectionContent -join ' ').Trim()
            line_count = $sectionContent.Count
        }
    }
    
    return $encounters
}

<#
.SYNOPSIS
Extract provider names

.DESCRIPTION
Finds medical provider names with titles:
- Dr. [Name]
- [Name], MD/DO/NP/PA/RN

.PARAMETER Lines
Array of text lines

.OUTPUTS
Array of unique provider names
#>
function Get-ProviderNames {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]        [AllowEmptyString()]        [string[]]$Lines
    )
    
    if ($null -eq $Lines -or $Lines.Count -eq 0) {
        return @()
    }
    
    $providers = @()
    $seen = @{}
    $providerPattern = '(?i)\b(Dr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[A-Z][a-z]+\s+[A-Z][a-z]+,?\s+(?:MD|DO|NP|PA|RN))\b'
    
    foreach ($line in $Lines) {
        if ($line -match $providerPattern) {
            $provider = $Matches[0] -replace ',\s*$', ''
            $key = $provider.ToLowerInvariant()
            
            if (-not $seen.ContainsKey($key)) {
                $providers += $provider
                $seen[$key] = $true
            }
        }
    }
    
    return $providers
}

<#
.SYNOPSIS
Extract vital signs

.DESCRIPTION
Finds vital sign measurements:
- Blood Pressure (BP)
- Heart Rate
- Temperature (Temp)
- Weight
- Height
- BMI

.PARAMETER Lines
Array of text lines

.OUTPUTS
Array of vital sign objects with type and value
#>
function Get-VitalSigns {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]        [AllowEmptyString()]        [string[]]$Lines
    )
    
    if ($null -eq $Lines -or $Lines.Count -eq 0) {
        return @()
    }
    
    $vitals = @()
    $vitalPattern = '(?i)(BP|Blood\s+Pressure|Heart\s+Rate|Temp|Temperature|Weight|Height|BMI)\s*:?\s*([\d/]+(?:\.\d+)?)'
    
    foreach ($line in $Lines) {
        foreach ($match in [regex]::Matches($line, $vitalPattern, 'IgnoreCase')) {
            $vitals += @{
                type = $match.Groups[1].Value
                value = $match.Groups[2].Value
            }
        }
    }
    
    return $vitals
}

# Export public functions
Export-ModuleMember -Function @(
    'Invoke-TextParser',
    'Get-PageMarkers',
    'Get-NearestPageNumber',
    'Get-DateMatches',
    'Get-DateValuesFromLine',
    'Get-SOAPSections',
    'Get-ProviderNames',
    'Get-VitalSigns'
)
