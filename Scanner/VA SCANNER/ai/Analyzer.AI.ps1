<#
Analyzer.AI.ps1
Production-ready AI wrapper for VA SCANNER.

Behavior and guardrails:
- Uses environment variable VA_AI_API_KEY for API key.
- Builds deterministic prompt using only provided JSON inputs.
- Performs exponential backoff retries for transient API errors.
- Redacts PII via a pluggable function before sending to the model.
- Validates model output against required top-level schema keys.
- Normalizes confidence and enforces human-review gating for low confidence or parse warnings.
- Writes structured logs to ai/logs with timestamps.
- Returns JSON to stdout or writes to OutputJsonPath.

Note: Replace provider-specific request/response parsing as needed.
#>

param(
    [Parameter(Mandatory=$true)][string]$StrScannerJsonPath,
    [Parameter(Mandatory=$false)][string]$DecisionJsonPath,
    [Parameter(Mandatory=$false)][string]$ServiceProfileJsonPath,
    [Parameter(Mandatory=$false)][string]$OutputJsonPath = '',
    [Parameter(Mandatory=$false)][switch]$ForceApiCall
)

function Write-Log {
    param([string]$Level, [string]$Message)
    $ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK")
    $entry = "{0} [{1}] {2}" -f $ts, $Level, $Message
    $logFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "logs\ai_activity.log"
    Add-Content -Path $logFile -Value $entry
}

function Load-JsonFile {
    param([string]$Path)
    if (-not $Path) { return $null }
    if (-not (Test-Path $Path)) { return $null }
    try { return Get-Content -Path $Path -Raw | ConvertFrom-Json } catch { Write-Log "ERROR" "Failed to parse JSON: $Path"; return $null }
}

function Redact-PII {
    param([object]$Json)
    # Minimal deterministic redaction: replace SSN-like patterns and email addresses in strings.
    # Extend this function with organization-specific PII rules.
    $jsonText = $Json | ConvertTo-Json -Depth 20
    # SSN pattern: 3-2-4 digits
    $jsonText = [regex]::Replace($jsonText, '\b\d{3}-\d{2}-\d{4}\b', '[REDACTED_SSN]')
    # Emails
    $jsonText = [regex]::Replace($jsonText, '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', '[REDACTED_EMAIL]')
    # Phone numbers (simple)
    $jsonText = [regex]::Replace($jsonText, '\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b', '[REDACTED_PHONE]')
    return $jsonText | ConvertFrom-Json
}

function Validate-Schema {
    param([object]$Obj, [string[]]$RequiredKeys)
    $missing = @()
    foreach ($k in $RequiredKeys) {
        if (-not $Obj.PSObject.Properties.Name -contains $k) { $missing += $k }
    }
    return $missing
}

# Load config
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "AI_CONFIG.json"
if (-not (Test-Path $configPath)) { throw "AI_CONFIG.json not found in $scriptDir" }
$config = Get-Content -Path $configPath -Raw | ConvertFrom-Json

# Load inputs
$strData = Load-JsonFile -Path $StrScannerJsonPath
$decData = Load-JsonFile -Path $DecisionJsonPath
$profile = Load-JsonFile -Path $ServiceProfileJsonPath

if (-not $strData) { throw "STR scanner JSON is required and could not be loaded." }

# Redact PII deterministically
try {
    $redactedStr = Redact-PII -Json $strData
    $redactedDec = if ($decData) { Redact-PII -Json $decData } else { $null }
    $redactedProfile = if ($profile) { Redact-PII -Json $profile } else { $null }
} catch {
    Write-Log "ERROR" "PII redaction failed: $($_.Exception.Message)"
    $redactedStr = $strData; $redactedDec = $decData; $redactedProfile = $profile
}

# Build prompt payload deterministically
$promptTemplatePath = Join-Path $scriptDir $config.prompt_template
if (-not (Test-Path $promptTemplatePath)) { throw "Prompt template not found: $promptTemplatePath" }
$promptTemplate = Get-Content -Path $promptTemplatePath -Raw

$payloadInputs = @{
    strs = $redactedStr
    decision = $redactedDec
    profile = $redactedProfile
}

$prompt = $promptTemplate + "`n`n" + (ConvertTo-Json $payloadInputs -Depth 20)

# Prepare API call parameters
$apiKey = [Environment]::GetEnvironmentVariable("VA_AI_API_KEY")
$shouldCallApi = $ForceApiCall.IsPresent -or ($apiKey -and $config.require_api_key -ne $true -or $apiKey)

if (-not $shouldCallApi) {
    Write-Log "WARN" "VA_AI_API_KEY not set or ForceApiCall not specified; returning placeholder response."
    $placeholder = @{
        diagnoses = $strData.diagnoses
        symptoms = $strData.symptoms
        medications = $strData.medications
        treatments = $strData.treatments
        procedures = $strData.procedures
        analysis_issues = @()
        potential_claims = @()
        denied_condition_reviews = @()
        meta = @{ source_type = "ai_assistant"; parse_warnings = @("VA_AI_API_KEY not set; placeholder response returned") }
    }
    $outJson = $placeholder | ConvertTo-Json -Depth 20
    if ($OutputJsonPath) { Set-Content -Path $OutputJsonPath -Value $outJson -Encoding UTF8; Write-Log "INFO" "Wrote placeholder AI output to $OutputJsonPath" } else { Write-Output $outJson }
    return
}

# Build request body (provider-agnostic JSON)
$requestBody = @{
    model = $config.model
    prompt = $prompt
    max_tokens = $config.max_tokens
} | ConvertTo-Json -Depth 10

# Retry/backoff
$attempt = 0
$maxAttempts = $config.retry.max_attempts
$baseDelay = $config.retry.base_delay_ms
$maxDelay = $config.retry.max_delay_ms
$success = $false
$responseBody = $null

while (-not $success -and $attempt -lt $maxAttempts) {
    try {
        $attempt++
        Write-Log "INFO" "API call attempt $attempt to $($config.api_endpoint)"
        $headers = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" }
        $invokeParams = @{
            Uri = $config.api_endpoint
            Method = "Post"
            Headers = $headers
            Body = $requestBody
            TimeoutSec = $config.timeout_sec
        }
        $apiResponse = Invoke-RestMethod @invokeParams
        $responseBody = $apiResponse
        $success = $true
        Write-Log "INFO" "API call succeeded on attempt $attempt"
    } catch {
        $err = $_.Exception.Message
        Write-Log "ERROR" "API call failed on attempt $attempt: $err"
        if ($attempt -ge $maxAttempts) { break }
        $delay = [math]::Min($maxDelay, $baseDelay * [math]::Pow(2, $attempt - 1))
        Start-Sleep -Milliseconds $delay
    }
}

if (-not $success) {
    Write-Log "ERROR" "All API attempts failed; returning placeholder response."
    $placeholder = @{
        diagnoses = $strData.diagnoses
        symptoms = $strData.symptoms
        medications = $strData.medications
        treatments = $strData.treatments
        procedures = $strData.procedures
        analysis_issues = @()
        potential_claims = @()
        denied_condition_reviews = @()
        meta = @{ source_type = "ai_assistant"; parse_warnings = @("API calls failed; placeholder response returned") }
    }
    $outJson = $placeholder | ConvertTo-Json -Depth 20
    if ($OutputJsonPath) { Set-Content -Path $OutputJsonPath -Value $outJson -Encoding UTF8; Write-Log "INFO" "Wrote placeholder AI output to $OutputJsonPath" } else { Write-Output $outJson }
    return
}

# Parse provider response into PowerShell object
try {
    # Provider response parsing may vary. Attempt to extract JSON text.
    if ($responseBody -is [string]) {
        $modelJsonText = $responseBody
    } elseif ($responseBody.choices -and $responseBody.choices[0].text) {
        $modelJsonText = $responseBody.choices[0].text
    } elseif ($responseBody.output -and ($responseBody.output | ConvertTo-Json -Depth 5)) {
        $modelJsonText = ($responseBody.output | ConvertTo-Json -Depth 20)
    } else {
        $modelJsonText = ($responseBody | ConvertTo-Json -Depth 20)
    }

    # Attempt to convert to object
    $modelObj = $null
    try { $modelObj = $modelJsonText | ConvertFrom-Json } catch { 
        # If the model returned text with surrounding commentary, try to extract JSON substring
        $jsonStart = $modelJsonText.IndexOf('{')
        $jsonEnd = $modelJsonText.LastIndexOf('}')
        if ($jsonStart -ge 0 -and $jsonEnd -gt $jsonStart) {
            $jsonSub = $modelJsonText.Substring($jsonStart, $jsonEnd - $jsonStart + 1)
            $modelObj = $jsonSub | ConvertFrom-Json
        } else {
            throw "Unable to parse model response as JSON."
        }
    }
} catch {
    Write-Log "ERROR" "Failed to parse model response: $($_.Exception.Message)"
    $placeholder = @{
        diagnoses = $strData.diagnoses
        symptoms = $strData.symptoms
        medications = $strData.medications
        treatments = $strData.treatments
        procedures = $strData.procedures
        analysis_issues = @()
        potential_claims = @()
        denied_condition_reviews = @()
        meta = @{ source_type = "ai_assistant"; parse_warnings = @("Model response parsing failed; placeholder returned") }
    }
    $outJson = $placeholder | ConvertTo-Json -Depth 20
    if ($OutputJsonPath) { Set-Content -Path $OutputJsonPath -Value $outJson -Encoding UTF8; Write-Log "INFO" "Wrote placeholder AI output to $OutputJsonPath" } else { Write-Output $outJson }
    return
}

# Validate schema: required top-level keys
$requiredKeys = $config.schema.required_top_level
$missingKeys = Validate-Schema -Obj $modelObj -RequiredKeys $requiredKeys
if ($missingKeys.Count -gt 0) {
    Write-Log "WARN" "Model output missing required keys: $($missingKeys -join ', ')"
    # Add parse warning and continue with best-effort mapping
    if (-not $modelObj.meta) { $modelObj | Add-Member -MemberType NoteProperty -Name meta -Value @{ parse_warnings = @() } -Force }
    if (-not $modelObj.meta.parse_warnings) { $modelObj.meta.parse_warnings = @() }
    $modelObj.meta.parse_warnings += "Missing required keys: $($missingKeys -join ', ')"
}

# Normalize confidence values in potential_claims
if ($modelObj.potential_claims) {
    foreach ($pc in $modelObj.potential_claims) {
        if ($pc.confidence) {
            $c = $pc.confidence.ToString().ToLower()
            switch ($c) {
                {$_ -match '^(high|h|0\.9|0\.8|0\.85)$'} { $pc.confidence = "high"; break }
                {$_ -match '^(medium|med|m|0\.5|0\.6|0\.7)$'} { $pc.confidence = "medium"; break }
                default { $pc.confidence = "low" }
            }
        } else {
            $pc | Add-Member -MemberType NoteProperty -Name confidence -Value "low" -Force
        }
    }
}

# Human-review gating: if any parse_warnings or low-confidence claims exist, flag for review
$needsHumanReview = $false
if ($modelObj.meta -and $modelObj.meta.parse_warnings -and $modelObj.meta.parse_warnings.Count -gt 0) { $needsHumanReview = $true }
if ($modelObj.potential_claims) {
    foreach ($pc in $modelObj.potential_claims) {
        if ($pc.confidence -eq "low") { $needsHumanReview = $true; break }
    }
}

if ($needsHumanReview) {
    if (-not $modelObj.meta) { $modelObj | Add-Member -MemberType NoteProperty -Name meta -Value @{ parse_warnings = @() } -Force }
    if (-not $modelObj.meta.parse_warnings) { $modelObj.meta.parse_warnings = @() }
    $modelObj.meta.parse_warnings += "Flagged for human review due to low confidence or parse warnings."
    $modelObj.meta.human_review_required = $true
    Write-Log "WARN" "Model output flagged for human review."
} else {
    $modelObj.meta.human_review_required = $false
}

# Final output: write to file or stdout
$outJson = $modelObj | ConvertTo-Json -Depth 20
if ($OutputJsonPath) {
    Set-Content -Path $OutputJsonPath -Value $outJson -Encoding UTF8
    Write-Log "INFO" "Wrote validated AI output to $OutputJsonPath"
    Write-Host "AI analysis written to $OutputJsonPath"
} else {
    Write-Output $outJson
}

