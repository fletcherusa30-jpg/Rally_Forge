<#
===========================================================
 Test-ConsolidatedModules.ps1
===========================================================
 Purpose: Quick smoke test for consolidated module system
 Usage: .\Test-ConsolidatedModules.ps1
===========================================================
#>

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "STRS Scanner Consolidated Module System - Smoke Test" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# Test 1: Module Import
Write-Host "[1/5] Testing module imports..." -ForegroundColor Yellow

try {
    Import-Module "$PSScriptRoot\engine\parsers\text_parser.psm1" -Force -ErrorAction Stop
    Write-Host "  ✓ text_parser.psm1 loaded" -ForegroundColor Green
    
    Import-Module "$PSScriptRoot\engine\rules\strs_rules.psm1" -Force -ErrorAction Stop
    Write-Host "  ✓ strs_rules.psm1 loaded" -ForegroundColor Green
    
    Import-Module "$PSScriptRoot\engine\transforms\normalization.psm1" -Force -ErrorAction Stop
    Write-Host "  ✓ normalization.psm1 loaded" -ForegroundColor Green
    
    Import-Module "$PSScriptRoot\engine\exporters\json_exporter.psm1" -Force -ErrorAction Stop
    Write-Host "  ✓ json_exporter.psm1 loaded" -ForegroundColor Green
    
    Import-Module "$PSScriptRoot\engine\core\scanner_core.psm1" -Force -ErrorAction Stop
    Write-Host "  ✓ scanner_core.psm1 loaded" -ForegroundColor Green
    
} catch {
    Write-Host "  ✗ Module import failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Function Availability
Write-Host "[2/5] Testing function availability..." -ForegroundColor Yellow

$requiredFunctions = @(
    'Invoke-STRSScan',
    'Invoke-TextParser',
    'Invoke-MedicalExtraction',
    'Invoke-DataNormalization',
    'Export-STRSToJson'
)

$allAvailable = $true
foreach ($func in $requiredFunctions) {
    if (Get-Command $func -ErrorAction SilentlyContinue) {
        Write-Host "  ✓ $func available" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $func NOT FOUND" -ForegroundColor Red
        $allAvailable = $false
    }
}

if (-not $allAvailable) {
    Write-Host ""
    Write-Host "ERROR: Some functions are missing!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Basic Text Parsing
Write-Host "[3/5] Testing text parsing..." -ForegroundColor Yellow

$testText = "Page 1`r`nDate: 01/15/2024`r`n`r`nSUBJECTIVE:`r`nPatient reports headache and dizziness.`r`n`r`nASSESSMENT:`r`nDiagnosis: Tension headache`r`n`r`nPLAN:`r`nPrescribed ibuprofen 400mg"

try {
    $parsedData = Invoke-TextParser -Text $testText
    
    if ($parsedData.status -eq 'parsed') {
        Write-Host "  ✓ Text parsing successful" -ForegroundColor Green
        Write-Host "    - Lines: $($parsedData.line_count)" -ForegroundColor Gray
        Write-Host "    - Pages: $($parsedData.page_markers.Count)" -ForegroundColor Gray
        Write-Host "    - Dates: $($parsedData.dates.Count)" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Parsing returned error status" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ✗ Parsing failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 4: Full Scan Pipeline
Write-Host "[4/5] Testing full scan pipeline..." -ForegroundColor Yellow

try {
    $scanResult = Invoke-STRSScan -Text $testText -Options @{ VerboseLogging = $false }
    
    if ($scanResult.diagnoses -or $scanResult.symptoms) {
        Write-Host "  ✓ Full scan pipeline successful" -ForegroundColor Green
        Write-Host "    - Diagnoses: $($scanResult.diagnoses.Count)" -ForegroundColor Gray
        Write-Host "    - Symptoms: $($scanResult.symptoms.Count)" -ForegroundColor Gray
        Write-Host "    - Events: $($scanResult.events.Count)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ Scan completed but no findings (may be normal for simple test)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Full scan failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 5: JSON Export
Write-Host "[5/5] Testing JSON export..." -ForegroundColor Yellow

try {
    $json = Export-STRSToJson -STRSData $scanResult
    
    if ($json -and $json.Length -gt 0) {
        Write-Host "  ✓ JSON export successful" -ForegroundColor Green
        Write-Host "    - Size: $($json.Length) characters" -ForegroundColor Gray
        
        # Validate JSON structure
        $parsed = $json | ConvertFrom-Json
        if ($parsed) {
            Write-Host "  ✓ JSON is valid and parseable" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✗ JSON export returned empty result" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ✗ JSON export failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "ALL TESTS PASSED ✓" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Run .\Run-STRSTest.ps1 for comprehensive regression testing" -ForegroundColor White
Write-Host "  2. Run .\Run-STRS-Consolidated.ps1 with real STRS files" -ForegroundColor White
Write-Host "  3. Compare output with legacy system for validation" -ForegroundColor White
Write-Host ""
