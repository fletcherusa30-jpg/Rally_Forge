<#
Analyzer.AI.ps1 - AI assistant wrapper (production scaffold)
- Uses VA_AI_API_KEY environment variable.
- Redacts simple PII patterns.
- Performs retry/backoff and schema validation.
- Returns placeholder if API key not set or API fails.
#>

param(
    [Parameter(Mandatory=$true)][string]$StrScannerJsonPath,
    [Parameter(Mandatory=$false)][string]$DecisionJsonPath,
    [Parameter(Mandatory=$false)][string]$ServiceProfileJsonPath,
    [Parameter(Mandatory=$false)][string]$OutputJsonPath = "",
    [Parameter(Mandatory=$false)][switch]$ForceApiCall
)

function Write-Log { param($L,$M) $ts=(Get-Date).ToString("o"); $entry = "$ts [$L] $M"; $logFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "logs\ai_activity.log"; Add-Content -Path $logFile -Value $entry }
function Load-JsonFile { param($p) if (-not $p -or -not (Test-Path $p)) { return $null } try { return Get-Content -Path $p -Raw | ConvertFrom-Json } catch { Write-Log "ERROR" "Failed to parse JSON: $p"; return $null } }
function Redact-PII { param($Json) $t = $Json | ConvertTo-Json -Depth 20; $t = [regex]::Replace($t,'\b\d{3}-\d{2}-\d{4}\b','[REDACTED_SSN]'); $t = [regex]::Replace($t,'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b','[REDACTED_EMAIL]'); $t = [regex]::Replace($t,'\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b','[REDACTED_PHONE]'); return $t | ConvertFrom-Json }
function Validate-Schema { param($Obj,$Keys) $missing=@(); foreach ($k in $Keys) { if (-not $Obj.PSObject.Properties.Name -contains $k) { $missing += $k } }; return $missing }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "AI_CONFIG.json"
if (-not (Test-Path $configPath)) { throw "AI_CONFIG.json not found in $scriptDir" }
$config = Get-Content -Path $configPath -Raw | ConvertFrom-Json

$strData = Load-JsonFile -p $StrScannerJsonPath
$decData = Load-JsonFile -p $DecisionJsonPath
$profile = Load-JsonFile -p $ServiceProfileJsonPath

if (-not $strData) { throw "STR scanner JSON required." }

try { $redStr = Redact-PII -Json $strData } catch { Write-Log "ERROR" "Redaction failed"; $redStr = $strData }
try { $redDec = if ($decData) { Redact-PII -Json $decData } else { $null } } catch { $redDec = $decData }
try { $redProfile = if ($profile) { Redact-PII -Json $profile } else { $null } } catch { $redProfile = $profile }

$promptTemplatePath = Join-Path $scriptDir $config.prompt_template
if (-not (Test-Path $promptTemplatePath)) { throw "Prompt template not found: $promptTemplatePath" }
$promptTemplate = Get-Content -Path $promptTemplatePath -Raw
$payloadInputs = @{ strs = $redStr; decision = $redDec; profile = $redProfile }
$prompt = $promptTemplate + "`n`n" + (ConvertTo-Json $payloadInputs -Depth 20)

$apiKey = [Environment]::GetEnvironmentVariable("VA_AI_API_KEY")
$shouldCallApi = $ForceApiCall.IsPresent -or ($apiKey -and $config.require_api_key -ne $true -or $apiKey)

if (-not $shouldCallApi) {
    Write-Log "WARN" "VA_AI_API_KEY not set; returning placeholder response."
    $placeholder = @{ diagnoses = $strData.diagnoses; symptoms = $strData.symptoms; medications = $strData.medications; treatments = $strData.treatments; procedures = $strData.procedures; analysis_issues = @(); potential_claims = @(); denied_condition_reviews = @(); meta = @{ source_type = "ai_assistant"; parse_warnings = @("VA_AI_API_KEY not set; placeholder response returned") } }
    $out = $placeholder | ConvertTo-Json -Depth 20
    if ($OutputJsonPath) { Set-Content -Path $OutputJsonPath -Value $out -Encoding UTF8; Write-Log "INFO" "Wrote placeholder AI output to $OutputJsonPath" } else { Write-Output $out }
    return
}

# Build request body (provider-specific implementation required)
$requestBody = @{ model = $config.model; prompt = $prompt; max_tokens = $config.max_tokens } | ConvertTo-Json -Depth 10
$attempt = 0; $maxAttempts = $config.retry.max_attempts; $baseDelay = $config.retry.base_delay_ms; $maxDelay = $config.retry.max_delay_ms; $success = $false; $responseBody = $null
while (-not $success -and $attempt -lt $maxAttempts) {
    try {
        $attempt++
        Write-Log "INFO" "API call attempt $attempt to $($config.api_endpoint)"
        $headers = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" }
        $invokeParams = @{ Uri = $config.api_endpoint; Method = "Post"; Headers = $headers; Body = $requestBody; TimeoutSec = $config.timeout_sec }
        $apiResponse = Invoke-RestMethod @invokeParams
        $responseBody = $apiResponse
        $success = $true
        Write-Log "INFO" "API call succeeded on attempt $attempt"
    } catch {
        Write-Log "ERROR" "API call failed on attempt $($attempt): $($_.Exception.Message)"
        if ($attempt -ge $maxAttempts) { break }
        $delay = [math]::Min($maxDelay, $baseDelay * [math]::Pow(2, $attempt - 1))
        Start-Sleep -Milliseconds $delay
    }
}

if (-not $success) {
    Write-Log "ERROR" "All API attempts failed; returning placeholder response."
    $placeholder = @{ diagnoses = $strData.diagnoses; symptoms = $strData.symptoms; medications = $strData.medications; treatments = $strData.treatments; procedures = $strData.procedures; analysis_issues = @(); potential_claims = @(); denied_condition_reviews = @(); meta = @{ source_type = "ai_assistant"; parse_warnings = @("API calls failed; placeholder response returned") } }
    $out = $placeholder | ConvertTo-Json -Depth 20
    if ($OutputJsonPath) { Set-Content -Path $OutputJsonPath -Value $out -Encoding UTF8; Write-Log "INFO" "Wrote placeholder AI output to $OutputJsonPath" } else { Write-Output $out }
    return
}

# Parse model response
try {
    if ($responseBody -is [string]) { $modelJsonText = $responseBody } elseif ($responseBody.choices -and $responseBody.choices[0].text) { $modelJsonText = $responseBody.choices[0].text } else { $modelJsonText = ($responseBody | ConvertTo-Json -Depth 20) }
    try { $modelObj = $modelJsonText | ConvertFrom-Json } catch { $jsonStart = $modelJsonText.IndexOf('{'); $jsonEnd = $modelJsonText.LastIndexOf('}'); if ($jsonStart -ge 0 -and $jsonEnd -gt $jsonStart) { $jsonSub = $modelJsonText.Substring($jsonStart, $jsonEnd - $jsonStart + 1); $modelObj = $jsonSub | ConvertFrom-Json } else { throw "Unable to parse model response as JSON." } }
} catch {
    Write-Log "ERROR" "Failed to parse model response: $($_.Exception.Message)"
    $placeholder = @{ diagnoses = $strData.diagnoses; symptoms = $strData.symptoms; medications = $strData.medications; treatments = $strData.treatments; procedures = $strData.procedures; analysis_issues = @(); potential_claims = @(); denied_condition_reviews = @(); meta = @{ source_type = "ai_assistant"; parse_warnings = @("Model response parsing failed; placeholder returned") } }
    $out = $placeholder | ConvertTo-Json -Depth 20
    if ($OutputJsonPath) { Set-Content -Path $OutputJsonPath -Value $out -Encoding UTF8; Write-Log "INFO" "Wrote placeholder AI output to $OutputJsonPath" } else { Write-Output $out }
    return
}

# Validate required keys
$requiredKeys = $config.schema.required_top_level
$missingKeys = @()
foreach ($k in $requiredKeys) { if (-not $modelObj.PSObject.Properties.Name -contains $k) { $missingKeys += $k } }
if ($missingKeys.Count -gt 0) {
    if (-not $modelObj.meta) { $modelObj | Add-Member -MemberType NoteProperty -Name meta -Value @{ parse_warnings = @() } -Force }
    if (-not $modelObj.meta.parse_warnings) { $modelObj.meta.parse_warnings = @() }
    $modelObj.meta.parse_warnings += "Missing required keys: $($missingKeys -join ', ')"
}

# Normalize confidence and flag human review if needed
$needsHumanReview = $false
if ($modelObj.meta -and $modelObj.meta.parse_warnings -and $modelObj.meta.parse_warnings.Count -gt 0) { $needsHumanReview = $true }
if ($modelObj.potential_claims) {
    foreach ($pc in $modelObj.potential_claims) {
        if ($pc.confidence) {
            $c = $pc.confidence.ToString().ToLower()
            switch ($c) { {$_ -match '^(high|h)$'} { $pc.confidence = 'high'; break } {$_ -match '^(medium|med|m)$'} { $pc.confidence = 'medium'; break } default { $pc.confidence = 'low' } }
        } else { $pc | Add-Member -MemberType NoteProperty -Name confidence -Value 'low' -Force }
        if ($pc.confidence -eq 'low') { $needsHumanReview = $true }
    }
}

if ($needsHumanReview) {
    if (-not $modelObj.meta) { $modelObj | Add-Member -MemberType NoteProperty -Name meta -Value @{ parse_warnings = @() } -Force }
    if (-not $modelObj.meta.parse_warnings) { $modelObj.meta.parse_warnings = @() }
    $modelObj.meta.parse_warnings += "Flagged for human review due to low confidence or parse warnings."
    $modelObj.meta.human_review_required = $true
} else { $modelObj.meta.human_review_required = $false }

$outJson = $modelObj | ConvertTo-Json -Depth 20
if ($OutputJsonPath) { Set-Content -Path $OutputJsonPath -Value $outJson -Encoding UTF8; Write-Log "INFO" "Wrote validated AI output to $OutputJsonPath" } else { Write-Output $outJson }

