<# DEPRECATED — modules/Extractor.psm1
===========================================================
 DEPRECATION NOTICE:
   Logic migrated to: engine/rules/strs_rules.psm1::Invoke-MedicalExtraction
   Do not modify. Retained for fallback until validation completes.
   Migration date: March 9, 2026
===========================================================
#>

<# Extractor.psm1
STRS Extractor Module - Handles extraction of medical evidence from parsed text.
Extracts conditions, medications, procedures, and encounters using medical terminology patterns.
#>

function Invoke-StrsExtractor {
    param([object]$ParsedData)
    
    if (-not $ParsedData -or -not $ParsedData.rawText) {
        return @{ status = "error"; module = "Extractor.psm1"; error = "Invalid parsed data" }
    }

    $text = $ParsedData.rawText.ToLower()
    $lines = $text -split "`n"

    # Extract conditions/diagnoses
    $conditions = @()
    $conditionPatterns = @(
        '(?i)\b(PTSD|post[-\s]?traumatic\s+stress)\b',
        '(?i)\b(tinnitus|ringing\s+in\s+ears?)\b',
        '(?i)\b(hearing\s+loss|deafness)\b',
        '(?i)\b(back\s+pain|lumbar|cervical\s+strain)\b',
        '(?i)\b(knee\s+pain|meniscus|patella)\b',
        '(?i)\b(shoulder\s+pain|rotator\s+cuff)\b',
        '(?i)\b(migraine|headache)s?\b',
        '(?i)\b(sleep\s+apnea|OSA)\b',
        '(?i)\b(asthma|respiratory|COPD)\b',
        '(?i)\b(diabetes|hyperglyce[a|m]ia)\b',
        '(?i)\b(hypertension|high\s+blood\s+pressure)\b',
        '(?i)\b(depression|anxiety|mood\s+disorder)\b',
        '(?i)\b(TBI|traumatic\s+brain\s+injury|concussion)\b',
        '(?i)\b(arthritis|joint\s+pain|DJD)\b',
        '(?i)\b(skin\s+condition|dermatitis|rash)\b',
        '(?i)\b(IBS|irritable\s+bowel|gastro)\b'
    )

    foreach ($pattern in $conditionPatterns) {
        if ($text -match $pattern) {
            $condition = $Matches[0]
            $normalizedCondition = $condition -replace '\s+', ' '
            
            # Check for context (diagnosed, history of, complaint of)
            $contextPattern = "(?i)(diagnosed|history\\s+of|presenting\\s+with|complains?\\s+of|treated\\s+for)\\s+.*?$([regex]::Escape($condition))"
            $context = 'mentioned'
            if ($text -match $contextPattern) {
                $context = 'documented'
            }
            
            $conditions += @{
                name = $normalizedCondition
                context = $context
                firstMention = $ParsedData.dates[0] ?? 'unknown'
            }
        }
    }

    # Remove duplicates
    $conditions = $conditions | Sort-Object -Property name -Unique

    # Extract medications
    $medications = @()
    $medicationPatterns = @(
        '(?i)\b(ibuprofen|motrin|advil)\b',
        '(?i)\b(acetaminophen|tylenol)\b',
        '(?i)\b(naproxen|aleve)\b',
        '(?i)\b(tramadol|ultram)\b',
        '(?i)\b(gabapentin|neurontin)\b',
        '(?i)\b(prednisone|prednisolone)\b',
        '(?i)\b(sertraline|zoloft)\b',
        '(?i)\b(fluoxetine|prozac)\b',
        '(?i)\b(lisinopril|enalapril)\b',
        '(?i)\b(metformin|glucophage)\b',
        '(?i)\b(omeprazole|prilosec)\b',
        '(?i)\b(albuterol|ventolin)\b'
    )

    foreach ($pattern in $medicationPatterns) {
        if ($text -match $pattern) {
            $medication = $Matches[0]
            
            # Extract dosage if present
            $dosagePattern = "$([regex]::Escape($medication))\\s+([\\d\\.]+\\s*(?:mg|mcg|g|ml))"
            $dosage = 'not specified'
            if ($text -match $dosagePattern) {
                $dosage = $Matches[1]
            }
            
            $medications += @{
                name = $medication
                dosage = $dosage
            }
        }
    }

    $medications = $medications | Sort-Object -Property name -Unique

    # Extract encounters (from parsed sections)
    $extractedEncounters = @()
    foreach ($encounter in $ParsedData.encounters) {
        $encounterDate = 'unknown'
        if ($ParsedData.dates.Count -gt 0) {
            $encounterDate = $ParsedData.dates[0]
        }
        
        $extractedEncounters += @{
            date = $encounterDate
            section = $encounter.section
            content = $encounter.content.Substring(0, [Math]::Min(200, $encounter.content.Length))
            provider = if ($ParsedData.providers.Count -gt 0) { $ParsedData.providers[0] } else { 'unknown' }
        }
    }

    # Extract procedures/treatments
    $procedures = @()
    $procedurePatterns = @(
        '(?i)\b(X-ray|radiograph|imaging)\b',
        '(?i)\b(MRI|magnetic\s+resonance)\b',
        '(?i)\b(CT\s+scan|computed\s+tomography)\b',
        '(?i)\b(physical\s+therapy|PT)\b',
        '(?i)\b(injection|steroid\s+shot)\b',
        '(?i)\b(surgery|surgical|operation)\b',
        '(?i)\b(brace|splint|support)\b'
    )

    foreach ($pattern in $procedurePatterns) {
        if ($text -match $pattern) {
            $procedures += $Matches[0]
        }
    }

    return @{
        status = "extracted"
        module = "Extractor.psm1"
        conditions = $conditions
        medications = $medications
        encounters = $extractedEncounters
        procedures = $procedures
        totalFindings = $conditions.Count + $medications.Count + $procedures.Count
    }
}

Export-ModuleMember -Function Invoke-StrsExtractor
