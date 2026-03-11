<#
===========================================================
 json_exporter.psm1 — STRS JSON Export Engine
===========================================================
 Module: engine/exporters/json_exporter.psm1
 Purpose: Export STRS data to JSON format
 Created: March 9, 2026 (STRICT REFACTOR MODE consolidation)
 
 Consolidates logic from:
   - STRS.Output.ps1 (root and engine/)
   - modules/Output.psm1
===========================================================
#>

<#
.SYNOPSIS
Export STRS scan results to JSON

.DESCRIPTION
Converts STRS hashtable output to formatted JSON string

.PARAMETER STRSData
Hashtable from Invoke-STRSScan

.PARAMETER Depth
JSON recursion depth (default: 10)

.PARAMETER Compress
If true, outputs minified JSON (default: false)

.OUTPUTS
JSON string
#>
function Export-STRSToJson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [hashtable]$STRSData,
        
        [Parameter(Mandatory = $false)]
        [int]$Depth = 10,
        
        [Parameter(Mandatory = $false)]
        [switch]$Compress
    )
    
    process {
        try {
            # Validate required structure
            $validated = Validate-STRSStructure -Data $STRSData
            
            if (-not $validated.valid) {
                throw "Invalid STRS structure: $($validated.errors -join ', ')"
            }
            
            # Convert to JSON
            $jsonParams = @{
                InputObject = $STRSData
                Depth = $Depth
            }
            
            if (-not $Compress) {
                $jsonParams['Compress'] = $false
            }
            
            $json = ConvertTo-Json @jsonParams
            
            return $json
            
        } catch {
            # Return error as JSON
            $errorOutput = @{
                status = "export_error"
                error = $_.Exception.Message
                stack_trace = $_.ScriptStackTrace
            }
            
            return ($errorOutput | ConvertTo-Json -Depth 5)
        }
    }
}

<#
.SYNOPSIS
Export STRS results to JSON file

.DESCRIPTION
Saves STRS scan results to a JSON file

.PARAMETER STRSData
Hashtable from Invoke-STRSScan

.PARAMETER Path
Output file path

.PARAMETER Depth
JSON recursion depth (default: 10)

.PARAMETER Compress
If true, outputs minified JSON (default: false)

.PARAMETER Force
Overwrite existing file (default: false)

.OUTPUTS
None (writes to file)
#>
function Export-STRSToJsonFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [hashtable]$STRSData,
        
        [Parameter(Mandatory = $true)]
        [string]$Path,
        
        [Parameter(Mandatory = $false)]
        [int]$Depth = 10,
        
        [Parameter(Mandatory = $false)]
        [switch]$Compress,
        
        [Parameter(Mandatory = $false)]
        [switch]$Force
    )
    
    process {
        try {
            # Check if file exists
            if ((Test-Path $Path) -and -not $Force) {
                throw "File already exists: $Path (use -Force to overwrite)"
            }
            
            # Export to JSON string
            $exportParams = @{
                STRSData = $STRSData
                Depth = $Depth
            }
            
            if ($Compress) {
                $exportParams['Compress'] = $true
            }
            
            $json = Export-STRSToJson @exportParams
            
            # Create directory if doesn't exist
            $directory = Split-Path -Path $Path -Parent
            if ($directory -and -not (Test-Path $directory)) {
                New-Item -ItemType Directory -Path $directory -Force | Out-Null
            }
            
            # Write to file with UTF-8 encoding
            [System.IO.File]::WriteAllText($Path, $json, [System.Text.Encoding]::UTF8)
            
            Write-Verbose "STRS data exported to: $Path"
            
        } catch {
            Write-Error "Failed to export STRS data to file: $_"
            throw
        }
    }
}

<#
.SYNOPSIS
Validate STRS data structure

.DESCRIPTION
Ensures STRS data contains all required fields and proper types

.PARAMETER Data
Hashtable to validate

.OUTPUTS
Hashtable with 'valid' boolean and 'errors' array
#>
function Validate-STRSStructure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Data
    )
    
    $errors = @()
    
    # Check required top-level fields
    $requiredFields = @('diagnoses', 'symptoms', 'events')
    
    foreach ($field in $requiredFields) {
        if (-not $Data.ContainsKey($field)) {
            $errors += "Missing required field: $field"
        }
    }
    
    # Validate field types (should be arrays)
    $arrayFields = @('diagnoses', 'symptoms', 'events', 'chronic_diagnoses', 'chronic_symptoms', 
                     'service_connection_opportunities', 'page_numbers', 'dates')
    
    foreach ($field in $arrayFields) {
        if ($Data.ContainsKey($field)) {
            $value = $Data[$field]
            if ($null -ne $value -and $value -isnot [array]) {
                $errors += "Field '$field' must be an array, got: $($value.GetType().Name)"
            }
        }
    }
    
    # Validate meta structure if present
    if ($Data.ContainsKey('meta') -and $null -ne $Data.meta) {
        if ($Data.meta -isnot [hashtable]) {
            $errors += "Field 'meta' must be a hashtable"
        }
    }
    
    return @{
        valid = ($errors.Count -eq 0)
        errors = $errors
    }
}

<#
.SYNOPSIS
Convert STRS data to formatted table

.DESCRIPTION
Creates a human-readable table view of STRS findings

.PARAMETER STRSData
Hashtable from Invoke-STRSScan

.OUTPUTS
Formatted string table
#>
function Format-STRSAsTable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [hashtable]$STRSData
    )
    
    process {
        $output = @()
        $output += "=" * 80
        $output += "STRS SCAN RESULTS"
        $output += "=" * 80
        
        # Summary counts
        $diagnosesCount = if ($STRSData.diagnoses) { $STRSData.diagnoses.Count } else { 0 }
        $symptomsCount = if ($STRSData.symptoms) { $STRSData.symptoms.Count } else { 0 }
        $eventsCount = if ($STRSData.events) { $STRSData.events.Count } else { 0 }
        
        $output += ""
        $output += "SUMMARY:"
        $output += "  Diagnoses: $diagnosesCount"
        $output += "  Symptoms: $symptomsCount"
        $output += "  Events: $eventsCount"
        
        # Diagnoses table
        if ($diagnosesCount -gt 0) {
            $output += ""
            $output += "-" * 80
            $output += "DIAGNOSES:"
            $output += "-" * 80
            
            foreach ($diagnosis in $STRSData.diagnoses) {
                $page = if ($diagnosis.page_number) { "Page $($diagnosis.page_number)" } else { "Unknown page" }
                $date = if ($diagnosis.date) { $diagnosis.date } else { "No date" }
                $output += "  [$page] [$date] $($diagnosis.text)"
            }
        }
        
        # Symptoms table
        if ($symptomsCount -gt 0) {
            $output += ""
            $output += "-" * 80
            $output += "SYMPTOMS:"
            $output += "-" * 80
            
            foreach ($symptom in $STRSData.symptoms) {
                $page = if ($symptom.page_number) { "Page $($symptom.page_number)" } else { "Unknown page" }
                $date = if ($symptom.date) { $symptom.date } else { "No date" }
                $output += "  [$page] [$date] $($symptom.text)"
            }
        }
        
        # Events table
        if ($eventsCount -gt 0) {
            $output += ""
            $output += "-" * 80
            $output += "EVENTS:"
            $output += "-" * 80
            
            foreach ($event in $STRSData.events) {
                $page = if ($event.page_number) { "Page $($event.page_number)" } else { "Unknown page" }
                $date = if ($event.date) { $event.date } else { "No date" }
                $output += "  [$page] [$date] $($event.text)"
            }
        }
        
        $output += ""
        $output += "=" * 80
        
        return ($output -join "`n")
    }
}

# Export public functions
Export-ModuleMember -Function @(
    'Export-STRSToJson',
    'Export-STRSToJsonFile',
    'Validate-STRSStructure',
    'Format-STRSAsTable'
)
