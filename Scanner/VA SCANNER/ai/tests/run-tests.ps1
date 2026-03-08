<#
run-tests.ps1
Runs the orchestration and checks that AI output file exists and contains required keys.
#>
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$orchestrate = Join-Path $scriptDir "..\orchestrate-ai.ps1"
$outputPath = Join-Path $scriptDir "..\output\ai_analysis.json"

& $orchestrate -ScannerJson "..\output\sample_str.json" -AiOutput "..\output\ai_analysis.json"

if (-not (Test-Path $outputPath)) { Write-Host "Test failed: AI output not created"; exit 1 }
try {
    $out = Get-Content -Path $outputPath -Raw | ConvertFrom-Json
    $required = @("diagnoses","symptoms","medications","treatments","procedures","analysis_issues","potential_claims","denied_condition_reviews","meta")
    $missing = @()
    foreach ($k in $required) { if (-not $out.PSObject.Properties.Name -contains $k) { $missing += $k } }
    if ($missing.Count -gt 0) { Write-Host "Test failed: missing keys $($missing -join ', ')"; exit 1 } else { Write-Host "All tests passed." }
} catch {
    Write-Host "Test failed: $($_.Exception.Message)"; exit 1
}

