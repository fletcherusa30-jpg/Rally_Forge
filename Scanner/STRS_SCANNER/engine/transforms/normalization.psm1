<#
===========================================================
 normalization.psm1 — STRS Data Normalization
===========================================================
 Module: engine/transforms/normalization.psm1
 Purpose: Normalize and clean extracted medical data
 Created: March 9, 2026 (STRICT REFACTOR MODE consolidation)
 
 Consolidates logic from:
   - engine/STRS.Utils.ps1
===========================================================
#>

<#
.SYNOPSIS
Main data normalization function

.DESCRIPTION
Normalizes analyzed STRS data:
- Removes duplicate findings
- Standardizes text formatting
- Cleans extracted values
- Ensures consistent data structure

.PARAMETER AnalyzedData
Hashtable from Invoke-AnalysisEngine

.OUTPUTS
Hashtable with normalized data
#>
function Invoke-DataNormalization {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$AnalyzedData
    )
    
    # Normalize diagnoses
    $normalizedDiagnoses = @()
    if ($AnalyzedData.diagnoses) {
        foreach ($diagnosis in $AnalyzedData.diagnoses) {
            $normalizedDiagnoses += Normalize-Finding -Finding $diagnosis
        }
    }
    
    # Normalize symptoms
    $normalizedSymptoms = @()
    if ($AnalyzedData.symptoms) {
        foreach ($symptom in $AnalyzedData.symptoms) {
            $normalizedSymptoms += Normalize-Finding -Finding $symptom
        }
    }
    
    # Normalize events
    $normalizedEvents = @()
    if ($AnalyzedData.events) {
        foreach ($event in $AnalyzedData.events) {
            $normalizedEvents += Normalize-Finding -Finding $event
        }
    }
    
    # Normalize chronic findings
    $normalizedChronicDiagnoses = @()
    if ($AnalyzedData.chronic_diagnoses) {
        foreach ($item in $AnalyzedData.chronic_diagnoses) {
            $normalizedChronicDiagnoses += @{
                condition = Normalize-Text -Text $item.condition
                occurrences = $item.occurrences
                first_mention = $item.first_mention
                last_mention = $item.last_mention
                chronicity = $item.chronicity
            }
        }
    }
    
    $normalizedChronicSymptoms = @()
    if ($AnalyzedData.chronic_symptoms) {
        foreach ($item in $AnalyzedData.chronic_symptoms) {
            $normalizedChronicSymptoms += @{
                symptom = Normalize-Text -Text $item.symptom
                occurrences = $item.occurrences
                first_mention = $item.first_mention
                last_mention = $item.last_mention
                chronicity = $item.chronicity
            }
        }
    }
    
    # Remove duplicates
    $uniqueDiagnoses = Remove-DuplicateFindings -Findings $normalizedDiagnoses
    $uniqueSymptoms = Remove-DuplicateFindings -Findings $normalizedSymptoms
    $uniqueEvents = Remove-DuplicateFindings -Findings $normalizedEvents
    
    # Build normalized output
    $output = @{
        diagnoses = $uniqueDiagnoses
        symptoms = $uniqueSymptoms
        events = $uniqueEvents
        chronic_diagnoses = $normalizedChronicDiagnoses
        chronic_symptoms = $normalizedChronicSymptoms
        service_connection_opportunities = $AnalyzedData.service_connection_opportunities
        continuity = $AnalyzedData.continuity
        year_span = $AnalyzedData.year_span
        page_numbers = if ($AnalyzedData.page_numbers) { $AnalyzedData.page_numbers } else { @() }
        dates = if ($AnalyzedData.dates) { $AnalyzedData.dates } else { @() }
    }
    
    return $output
}

<#
.SYNOPSIS
Normalize a single finding

.DESCRIPTION
Cleans and standardizes a finding object

.PARAMETER Finding
Finding object (diagnosis, symptom, event)

.OUTPUTS
Normalized finding object
#>
function Normalize-Finding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Finding
    )
    
    $normalized = @{
        category = if ($Finding.category) { $Finding.category } else { 'unknown' }
        text = Normalize-Text -Text $Finding.text
        page_number = if ($Finding.page_number) { [int]$Finding.page_number } else { $null }
        date = if ($Finding.date) { Normalize-Date -DateString $Finding.date } else { $null }
        line_index = if ($Finding.line_index) { [int]$Finding.line_index } else { $null }
    }
    
    return $normalized
}

<#
.SYNOPSIS
Normalize text content

.DESCRIPTION
Cleans text:
- Trims whitespace
- Removes excessive spaces
- Standardizes quotes
- Removes control characters

.PARAMETER Text
Raw text string

.OUTPUTS
Cleaned text string
#>
function Normalize-Text {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Text
    )
    
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return ""
    }
    
    # Trim
    $cleaned = $Text.Trim()
    
    # Remove control characters except newlines
    $cleaned = $cleaned -replace '[\x00-\x08\x0B-\x0C\x0E-\x1F]', ''
    
    # Collapse multiple spaces to single space
    $cleaned = $cleaned -replace '\s+', ' '
    
    # Standardize quotes
    $cleaned = $cleaned -replace '[\u2018\u2019]', "'"
    $cleaned = $cleaned -replace '[\u201C\u201D]', '"'
    
    return $cleaned
}

<#
.SYNOPSIS
Normalize date string

.DESCRIPTION
Standardizes date formats to MM/DD/YYYY when possible

.PARAMETER DateString
Raw date string

.OUTPUTS
Normalized date string or original if parsing fails
#>
function Normalize-Date {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$DateString
    )
    
    if ([string]::IsNullOrWhiteSpace($DateString)) {
        return $null
    }
    
    # Try to parse as DateTime
    $parsedDate = $null
    $formats = @(
        'M/d/yyyy',
        'MM/dd/yyyy',
        'M/d/yy',
        'MM/dd/yy',
        'MMMM d, yyyy',
        'd MMM yyyy',
        'yyyy-MM-dd'
    )
    
    foreach ($format in $formats) {
        try {
            $parsedDate = [DateTime]::ParseExact($DateString, $format, [System.Globalization.CultureInfo]::InvariantCulture)
            break
        } catch {
            # Try next format
        }
    }
    
    if ($parsedDate) {
        return $parsedDate.ToString('MM/dd/yyyy')
    }
    
    # If parsing failed, return original
    return $DateString
}

<#
.SYNOPSIS
Remove duplicate findings

.DESCRIPTION
Removes findings with identical text and page numbers

.PARAMETER Findings
Array of finding objects

.OUTPUTS
Array of unique findings
#>
function Remove-DuplicateFindings {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [array]$Findings
    )
    
    if ($Findings.Count -eq 0) {
        return @()
    }
    
    $seen = @{}
    $unique = @()
    
    foreach ($finding in $Findings) {
        # Create key from text + page number
        $text = if ($finding.text) { $finding.text.ToLowerInvariant() } else { '' }
        $page = if ($finding.page_number) { $finding.page_number } else { 0 }
        $key = "${text}::${page}"
        
        if (-not $seen.ContainsKey($key)) {
            $unique += $finding
            $seen[$key] = $true
        }
    }
    
    return $unique
}

# Export public functions
Export-ModuleMember -Function @(
    'Invoke-DataNormalization',
    'Normalize-Finding',
    'Normalize-Text',
    'Normalize-Date',
    'Remove-DuplicateFindings'
)
