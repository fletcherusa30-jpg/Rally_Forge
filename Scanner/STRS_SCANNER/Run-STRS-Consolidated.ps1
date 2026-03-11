<#
===========================================================
 Run-STRS-Consolidated.ps1 — New STRS Scanner Entry Point
===========================================================
 Purpose: Main entry point using consolidated module system
 Created: March 9, 2026 (STRICT REFACTOR MODE consolidation)
 
 This script demonstrates the new module architecture.
 Once validated, this will replace STRS.Scanner.ps1
===========================================================
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$InputFile,
    
    [Parameter(Mandatory = $false)]
    [string]$OutputFile,
    
    [Parameter(Mandatory = $false)]
    [string]$Text,
    
    [Parameter(Mandatory = $false)]
    [switch]$Compress,
    
    [Parameter(Mandatory = $false)]
    [switch]$Verbose
)

# Import consolidated modules
$modulePath = "$PSScriptRoot\engine"

Import-Module "$modulePath\parsers\text_parser.psm1" -Force
Import-Module "$modulePath\rules\strs_rules.psm1" -Force
Import-Module "$modulePath\transforms\normalization.psm1" -Force
Import-Module "$modulePath\exporters\json_exporter.psm1" -Force
Import-Module "$modulePath\core\scanner_core.psm1" -Force

# Determine input source
$inputText = $null

if ($InputFile) {
    if (-not (Test-Path $InputFile)) {
        Write-Error "Input file not found: $InputFile"
        exit 1
    }
    $inputText = Get-Content -Path $InputFile -Raw
}
elseif ($Text) {
    $inputText = $Text
}
else {
    Write-Error "Must provide either -InputFile or -Text parameter"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\Run-STRS-Consolidated.ps1 -InputFile 'sample_str.txt' -OutputFile 'output.json'"
    Write-Host "  .\Run-STRS-Consolidated.ps1 -Text 'some medical text' -Compress"
    exit 1
}

# Run scan
Write-Host "Starting STRS scan with consolidated modules..." -ForegroundColor Cyan

$scanOptions = @{
    IncludeMetadata = $true
    StrictMode = $false
    VerboseLogging = $Verbose.IsPresent
}

try {
    $result = Invoke-STRSScan -Text $inputText -Options $scanOptions
    
    # Output results
    if ($OutputFile) {
        Export-STRSToJsonFile -STRSData $result -Path $OutputFile -Compress:$Compress -Force
        Write-Host "Results exported to: $OutputFile" -ForegroundColor Green
    }
    else {
        # Output to console
        $json = Export-STRSToJson -STRSData $result -Compress:$Compress
        Write-Output $json
    }
    
    # Show summary
    Write-Host ""
    Write-Host "Scan Summary:" -ForegroundColor Cyan
    Write-Host "  Diagnoses: $($result.diagnoses.Count)" -ForegroundColor White
    Write-Host "  Symptoms: $($result.symptoms.Count)" -ForegroundColor White
    Write-Host "  Events: $($result.events.Count)" -ForegroundColor White
    
    if ($result.meta -and $result.meta.parse_warnings) {
        Write-Host "  Warnings: $($result.meta.parse_warnings.Count)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Error "Scan failed: $_"
    Write-Error $_.ScriptStackTrace
    exit 1
}
