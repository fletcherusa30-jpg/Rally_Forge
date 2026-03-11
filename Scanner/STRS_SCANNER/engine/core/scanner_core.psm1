<#
===========================================================
 scanner_core.psm1 — STRS Scanner Core Engine
===========================================================
 Module: engine/core/scanner_core.psm1
 Purpose: Core orchestration logic for STRS scanning pipeline
 Created: March 9, 2026 (STRICT REFACTOR MODE consolidation)
 
 Consolidates logic from:
   - STRS.Scanner.ps1 (root)
   - Analyzer.Engine.ps1
   - engine/STRS.Analyzer.ps1
   - modules/Analyzer.psm1
   
 Dependencies (must be imported before this module):
   - text_parser.psm1
   - strs_rules.psm1
   - normalization.psm1
   - json_exporter.psm1
===========================================================
#>

<#
.SYNOPSIS
Main STRS scanning orchestration function

.DESCRIPTION
Orchestrates the complete STRS scanning pipeline:
1. Parse text into structured elements
2. Apply extraction rules
3. Analyze and cross-reference findings
4. Normalize data
5. Export to JSON

.PARAMETER Text
Raw text content from STRS document

.PARAMETER Options
Optional hashtable with configuration:
  - IncludeMetadata: Include parsing statistics (default: $true)
  - StrictMode: Fail on any parse warnings (default: $false)
  - VerboseLogging: Enable detailed logging (default: $false)

.OUTPUTS
Hashtable with structured STRS data ready for JSON export
#>
function Invoke-STRSScan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [string]$Text,
        
        [Parameter(Mandatory = $false)]
        [hashtable]$Options = @{}
    )
    
    begin {
        $includeMetadata = if ($Options.ContainsKey('IncludeMetadata')) { $Options.IncludeMetadata } else { $true }
        $strictMode = if ($Options.ContainsKey('StrictMode')) { $Options.StrictMode } else { $false }
        $verboseLogging = if ($Options.ContainsKey('VerboseLogging')) { $Options.VerboseLogging } else { $false }
        
        $parseWarnings = @()
    }
    
    process {
        try {
            # Validate input
            if ([string]::IsNullOrWhiteSpace($Text)) {
                throw "Input text is null or empty"
            }
            
            if ($verboseLogging) {
                Write-Verbose "[scanner_core] Starting STRS scan (text length: $($Text.Length) chars)"
            }
            
            # STEP 1: Parse text using text_parser module
            $parsedData = Invoke-TextParser -Text $Text
            
            if ($parsedData.parse_warnings) {
                $parseWarnings += $parsedData.parse_warnings
            }
            
            # STEP 2: Extract medical evidence using strs_rules
            $extractedData = Invoke-MedicalExtraction -ParsedData $parsedData
            
            if ($extractedData.parse_warnings) {
                $parseWarnings += $extractedData.parse_warnings
            }
            
            # STEP 3: Analyze and cross-reference
            $analyzedData = Invoke-AnalysisEngine -ExtractedData $extractedData
            
            if ($analyzedData.parse_warnings) {
                $parseWarnings += $analyzedData.parse_warnings
            }
            
            # STEP 4: Normalize data
            $normalizedData = Invoke-DataNormalization -AnalyzedData $analyzedData
            
            # STEP 5: Build final output structure
            $output = Build-STRSOutput -NormalizedData $normalizedData
            
            # Add metadata if requested
            if ($includeMetadata) {
                $output.meta = @{
                    source_type = "strs_scanner"
                    scan_timestamp = (Get-Date -Format "o")
                    parse_warnings = $parseWarnings
                    line_count = ($Text -split "`r?`n").Count
                    character_count = $Text.Length
                }
            }
            
            # Strict mode: fail if any warnings
            if ($strictMode -and $parseWarnings.Count -gt 0) {
                throw "Strict mode enabled: scan produced $($parseWarnings.Count) warnings"
            }
            
            if ($verboseLogging) {
                Write-Verbose "[scanner_core] Scan complete: $($output.diagnoses.Count) diagnoses, $($output.symptoms.Count) symptoms"
            }
            
            return $output
            
        } catch {
            $errorOutput = @{
                status = "error"
                error_message = $_.Exception.Message
                error_details = $_.ScriptStackTrace
                parse_warnings = $parseWarnings
                meta = @{
                    source_type = "strs_scanner"
                    scan_timestamp = (Get-Date -Format "o")
                }
            }
            
            if ($strictMode) {
                throw
            }
            
            return $errorOutput
        }
    }
}

<#
.SYNOPSIS
Analysis engine for cross-referencing and intelligence extraction

.DESCRIPTION
Analyzes extracted data to identify:
- Chronicity (condition appears 2+ times)
- Continuity (condition spans multiple years)
- Service connection opportunities
- Severity indicators
- Related conditions

.PARAMETER ExtractedData
Hashtable from Invoke-MedicalExtraction containing raw findings

.OUTPUTS
Hashtable with analysis results and enriched findings
#>
function Invoke-AnalysisEngine {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$ExtractedData
    )
    
    $diagnoses = if ($ExtractedData.diagnoses) { $ExtractedData.diagnoses } else { @() }
    $symptoms = if ($ExtractedData.symptoms) { $ExtractedData.symptoms } else { @() }
    $events = if ($ExtractedData.events) { $ExtractedData.events } else { @() }
    
    $analysisWarnings = @()
    
    # Analyze chronicity: group findings by normalized text
    $diagnosisGroups = $diagnoses | Group-Object -Property { $_.text.ToLowerInvariant().Trim() }
    $symptomGroups = $symptoms | Group-Object -Property { $_.text.ToLowerInvariant().Trim() }
    
    $chronicDiagnoses = @()
    foreach ($group in $diagnosisGroups) {
        if ($group.Count -ge 2) {
            $chronicDiagnoses += @{
                condition = $group.Name
                occurrences = $group.Count
                first_mention = ($group.Group | Sort-Object -Property page_number | Select-Object -First 1).page_number
                last_mention = ($group.Group | Sort-Object -Property page_number | Select-Object -Last 1).page_number
                chronicity = $true
            }
        }
    }
    
    $chronicSymptoms = @()
    foreach ($group in $symptomGroups) {
        if ($group.Count -ge 2) {
            $chronicSymptoms += @{
                symptom = $group.Name
                occurrences = $group.Count
                first_mention = ($group.Group | Sort-Object -Property page_number | Select-Object -First 1).page_number
                last_mention = ($group.Group | Sort-Object -Property page_number | Select-Object -Last 1).page_number
                chronicity = $true
            }
        }
    }
    
    # Analyze continuity: check if dates span multiple years
    $allDates = @()
    foreach ($item in ($diagnoses + $symptoms + $events)) {
        if ($item.date) {
            $allDates += $item.date
        }
    }
    
    $years = @()
    foreach ($dateStr in $allDates) {
        if ($dateStr -match '\b(\d{4})\b') {
            $year = [int]$Matches[1]
            if ($years -notcontains $year) {
                $years += $year
            }
        }
    }
    
    $continuity = ($years.Count -ge 2)
    
    # Service connection opportunity detection
    $serviceConnectionOpportunities = @()
    
    # Direct service connection: event + diagnosis on same/nearby pages
    foreach ($diagnosis in $diagnoses) {
        foreach ($event in $events) {
            $pageDiff = [Math]::Abs($diagnosis.page_number - $event.page_number)
            if ($pageDiff -le 5) {  # Within 5 pages
                $serviceConnectionOpportunities += @{
                    type = "direct"
                    condition = $diagnosis.text
                    event = $event.text
                    diagnosis_page = $diagnosis.page_number
                    event_page = $event.page_number
                    confidence = "high"
                }
            }
        }
    }
    
    # Build enriched output
    $output = @{
        diagnoses = $diagnoses
        symptoms = $symptoms
        events = $events
        chronic_diagnoses = $chronicDiagnoses
        chronic_symptoms = $chronicSymptoms
        continuity = $continuity
        year_span = if ($years.Count -gt 0) { @($years | Sort-Object) } else { @() }
        service_connection_opportunities = $serviceConnectionOpportunities
        parse_warnings = $analysisWarnings
    }
    
    return $output
}

<#
.SYNOPSIS
Build final STRS output structure

.DESCRIPTION
Constructs the final structured output matching the required JSON schema

.PARAMETER NormalizedData
Hashtable from Invoke-DataNormalization

.OUTPUTS
Hashtable ready for JSON export
#>
function Build-STRSOutput {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$NormalizedData
    )
    
    # Ensure all required fields exist
    $output = [ordered]@{
        diagnoses = if ($NormalizedData.diagnoses) { @($NormalizedData.diagnoses) } else { @() }
        symptoms = if ($NormalizedData.symptoms) { @($NormalizedData.symptoms) } else { @() }
        events = if ($NormalizedData.events) { @($NormalizedData.events) } else { @() }
        chronic_diagnoses = if ($NormalizedData.chronic_diagnoses) { @($NormalizedData.chronic_diagnoses) } else { @() }
        chronic_symptoms = if ($NormalizedData.chronic_symptoms) { @($NormalizedData.chronic_symptoms) } else { @() }
        service_connection_opportunities = if ($NormalizedData.service_connection_opportunities) { @($NormalizedData.service_connection_opportunities) } else { @() }
        page_numbers = if ($NormalizedData.page_numbers) { @($NormalizedData.page_numbers) } else { @() }
        dates = if ($NormalizedData.dates) { @($NormalizedData.dates) } else { @() }
    }
    
    return $output
}

# Export public functions
Export-ModuleMember -Function @(
    'Invoke-STRSScan',
    'Invoke-AnalysisEngine',
    'Build-STRSOutput'
)
