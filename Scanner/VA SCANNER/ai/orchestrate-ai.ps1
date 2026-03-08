<#
orchestrate-ai.ps1
Example orchestration:
- Expects deterministic scanner JSON at ..\output\sample_str.json (or pass path)
- Calls Analyzer.AI.ps1 and writes output to ..\output\ai_analysis.json
- Validates that output contains required top-level keys
#>

param(
    [string]$ScannerJson = "..\output\sample_str.json",
    [string]$AiOutput = "..\output\ai_analysis.json"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scannerJsonPath = Resolve-Path -Path (Join-Path $scriptDir $ScannerJson)
$aiScript = Join-Path $scriptDir "Analyzer.AI.ps1"
$aiOutputPath = Resolve-Path -Path (Join-Path $scriptDir $AiOutput) -ErrorAction SilentlyContinue
if (-not $aiOutputPath) { $aiOutputPath = Join-Path $scriptDir $AiOutput }

if (-not (Test-Path $scannerJsonPath)) { Write-Host "Scanner JSON not found: $scannerJsonPath"; exit 1 }

# Call AI wrapper (will return placeholder if VA_AI_API_KEY not set)
& $aiScript -StrScannerJsonPath $scannerJsonPath -OutputJsonPath $aiOutputPath

# Basic validation of AI output
try {
    $out = Get-Content -Path $aiOutputPath -Raw | ConvertFrom-Json
    $required = @("diagnoses","symptoms","medications","treatments","procedures","analysis_issues","potential_claims","denied_condition_reviews","meta")
    $missing = @()
    foreach ($k in $required) { if (-not $out.PSObject.Properties.Name -contains $k) { $missing += $k } }
    if ($missing.Count -gt 0) {
        Write-Host "AI output missing keys: $($missing -join ', ')" -ForegroundColor Yellow
    } else {
        Write-Host "AI output validated: all required keys present." -ForegroundColor Green
    }
} catch {
    Write-Host "Failed to validate AI output: $($_.Exception.Message)" -ForegroundColor Red
}

