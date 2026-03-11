<#
===========================================================
 strs_rules.psm1 — STRS Medical Extraction Rules
===========================================================
 Module: engine/rules/strs_rules.psm1
 Purpose: Medical evidence extraction using deterministic rules
 Created: March 9, 2026 (STRICT REFACTOR MODE consolidation)
 
 Consolidates logic from:
   - RegexLibrary.ps1
   - STRS.Regex.ps1
   - engine/STRS.NLP.ps1
===========================================================
 IMPORTANT: This module uses DETERMINISTIC regex-based extraction only.
 No AI, no inference, no hallucination. All patterns are explicit.
===========================================================
#>

# ============================================================
# REGEX PATTERN LIBRARY (Upgraded 2026)
# ============================================================

# Diagnoses: formal dx, assessments, impressions, ICD codes, findings
$Script:RegexDiagnosis = 'diagnosis|dx[: ]|assessment|impression|evaluation|finding|ICD[- ]?\d+|diagnosed with|condition|injury'

# Symptoms: complaints and reported symptoms, pain levels, functional limitations
$Script:RegexSymptoms = 'complaint|symptom|c/o|reports|states|presents with|noted|describes|pain|ache|difficulty|trouble|unable to|can.?t|unable|limitation'

# Medications: prescriptions, dosing patterns, frequencies, strengths
$Script:RegexMedications = 'Rx[: ]|prescribed|medication|mg|tablet|capsule|dose|BID|TID|QID|q\d+h|once daily|twice daily|three times|frequency|strength|formulation'

# Procedures: surgeries, imaging, treatments, therapies, LOD events
$Script:RegexProcedures = 'procedure|surgery|operation|surgical|operative|MRI|CT|x[- ]?ray|ultrasound|imaging|scan|profile|limited duty|LOD|therapy|physical therapy|PT|injection|biopsy|endoscopy|treatment'

# Events: injuries, accidents, incidents, trauma
$Script:RegexEvents = 'event|injury|injured|incident|accident|trauma|line of duty|lod|fall|blast|explosion|collision|struck|hit|wounded|combat|deployment'

# Service connection keywords
$Script:RegexServiceConnection = 'service connected|in service|during service|incident|exposure|combat|deployment|active duty|while serving|military service'

# Chronicity indicators
$Script:RegexChronicity = 'chronic|ongoing|recurrent|persistent|recurring|long.?standing|for years|for months|continued|worsens|progressive'

# Severity/functional impact
$Script:RegexSeverity = 'severe|moderate|mild|limiting|functional impairment|disability|unable|prevents|restricts|interferes|impairs|debilitating'

<#
.SYNOPSIS
Main medical extraction function

.DESCRIPTION
Extracts medical evidence from parsed STRS data using deterministic rules

.PARAMETER ParsedData
Hashtable from Invoke-TextParser

.OUTPUTS
Hashtable with extracted diagnoses, symptoms, events, medications, procedures
#>
function Invoke-MedicalExtraction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$ParsedData
    )
    
    $lines = $ParsedData.lines
    $pageMarkers = $ParsedData.page_markers
    $parseWarnings = @()
    
    # Extract each category
    $diagnoses = Get-KeywordMatches -Lines $lines -PageMarkers $pageMarkers -Category 'diagnosis' -Pattern $Script:RegexDiagnosis
    $symptoms = Get-KeywordMatches -Lines $lines -PageMarkers $pageMarkers -Category 'symptoms' -Pattern $Script:RegexSymptoms
    $medications = Get-KeywordMatches -Lines $lines -PageMarkers $pageMarkers -Category 'medications' -Pattern $Script:RegexMedications
    $procedures = Get-KeywordMatches -Lines $lines -PageMarkers $pageMarkers -Category 'procedures' -Pattern $Script:RegexProcedures
    $events = Get-KeywordMatches -Lines $lines -PageMarkers $pageMarkers -Category 'events' -Pattern $Script:RegexEvents
    
    # Build output
    $output = @{
        diagnoses = $diagnoses
        symptoms = $symptoms
        medications = $medications
        procedures = $procedures
        events = $events
        parse_warnings = $parseWarnings
    }
    
    return $output
}

<#
.SYNOPSIS
Extract keyword matches from text lines

.DESCRIPTION
Finds all lines matching a regex pattern, annotates with page numbers and dates

.PARAMETER Lines
Array of text lines

.PARAMETER PageMarkers
Array of page marker objects

.PARAMETER Category
Category label (diagnosis, symptoms, etc.)

.PARAMETER Pattern
Regex pattern to match

.OUTPUTS
Array of match objects with category, text, page_number, date, line_index
#>
function Get-KeywordMatches {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Lines,
        
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [array]$PageMarkers,
        
        [Parameter(Mandatory = $true)]
        [string]$Category,
        
        [Parameter(Mandatory = $true)]
        [string]$Pattern
    )
    
    $results = @()
    
    for ($index = 0; $index -lt $Lines.Count; $index++) {
        $line = $Lines[$index]
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        
        # Check if line matches pattern
        if ($line -notmatch $Pattern) { continue }
        
        # Get page number for this line
        $pageNumber = Get-NearestPageNumber -LineIndex $index -PageMarkers $PageMarkers
        
        # Get dates from this line
        $lineDates = Get-DateValuesFromLine -Line $line
        $dateValue = if ($lineDates.Count -gt 0) { $lineDates[0] } else { $null }
        
        # Build result object
        $results += [pscustomobject]@{
            category = $Category
            text = $line.Trim()
            page_number = $pageNumber
            date = $dateValue
            line_index = $index
        }
    }
    
    return $results
}

<#
.SYNOPSIS
Get diagnosis-specific pattern

.DESCRIPTION
Returns the regex pattern for diagnoses

.OUTPUTS
String regex pattern
#>
function Get-DiagnosisPattern {
    return $Script:RegexDiagnosis
}

<#
.SYNOPSIS
Get symptom-specific pattern

.DESCRIPTION
Returns the regex pattern for symptoms

.OUTPUTS
String regex pattern
#>
function Get-SymptomPattern {
    return $Script:RegexSymptoms
}

<#
.SYNOPSIS
Get medication-specific pattern

.DESCRIPTION
Returns the regex pattern for medications

.OUTPUTS
String regex pattern
#>
function Get-MedicationPattern {
    return $Script:RegexMedications
}

<#
.SYNOPSIS
Get procedure-specific pattern

.DESCRIPTION
Returns the regex pattern for procedures

.OUTPUTS
String regex pattern
#>
function Get-ProcedurePattern {
    return $Script:RegexProcedures
}

<#
.SYNOPSIS
Get event-specific pattern

.DESCRIPTION
Returns the regex pattern for events/injuries

.OUTPUTS
String regex pattern
#>
function Get-EventPattern {
    return $Script:RegexEvents
}

<#
.SYNOPSIS
Get service connection pattern

.DESCRIPTION
Returns the regex pattern for service connection indicators

.OUTPUTS
String regex pattern
#>
function Get-ServiceConnectionPattern {
    return $Script:RegexServiceConnection
}

<#
.SYNOPSIS
Get chronicity pattern

.DESCRIPTION
Returns the regex pattern for chronicity indicators

.OUTPUTS
String regex pattern
#>
function Get-ChronicityPattern {
    return $Script:RegexChronicity
}

<#
.SYNOPSIS
Get severity pattern

.DESCRIPTION
Returns the regex pattern for severity/functional impact

.OUTPUTS
String regex pattern
#>
function Get-SeverityPattern {
    return $Script:RegexSeverity
}

# Export public functions
Export-ModuleMember -Function @(
    'Invoke-MedicalExtraction',
    'Get-KeywordMatches',
    'Get-DiagnosisPattern',
    'Get-SymptomPattern',
    'Get-MedicationPattern',
    'Get-ProcedurePattern',
    'Get-EventPattern',
    'Get-ServiceConnectionPattern',
    'Get-ChronicityPattern',
    'Get-SeverityPattern'
)

# Note: The functions Get-NearestPageNumber and Get-DateValuesFromLine
# are imported from text_parser.psm1 and used internally
