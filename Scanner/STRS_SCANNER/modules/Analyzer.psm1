<# DEPRECATED — modules/Analyzer.psm1
===========================================================
 DEPRECATION NOTICE:
   Logic migrated to: engine/core/scanner_core.psm1::Invoke-AnalysisEngine
   Do not modify. Retained for fallback until validation completes.
   Migration date: March 9, 2026
===========================================================
#>

<# Analyzer.psm1
STRS Analyzer Module - Handles analysis and service connection opportunity detection.
Maps conditions to presumptive pathways, checks chronicity and continuity of care.
#>

function Invoke-StrsAnalyzer {
    param([object]$ExtractedData)
    
    if (-not $ExtractedData -or -not $ExtractedData.conditions) {
        return @{ status = "error"; module = "Analyzer.psm1"; error = "No extracted data" }
    }

    # Map conditions to service connection opportunities
    $opportunities = @()
    
    # Presumptive condition mappings (Agent Orange, burn pits, combat)
    $presumptiveMappings = @{
        'PTSD' = @{ pathway = 'Combat Stressor'; authority = '38 CFR 3.304(f)'; likelihood = 'High' }
        'post-traumatic stress' = @{ pathway = 'Combat Stressor'; authority = '38 CFR 3.304(f)'; likelihood = 'High' }
        'tinnitus' = @{ pathway = 'Noise Exposure'; authority = '38 CFR 3.385'; likelihood = 'High' }
        'hearing loss' = @{ pathway = 'Noise Exposure'; authority = '38 CFR 3.385'; likelihood = 'High' }
        'asthma' = @{ pathway = 'Burn Pit Exposure'; authority = '38 CFR 3.317'; likelihood = 'Medium' }
        'sleep apnea' = @{ pathway = 'Secondary to PTSD/Obesity'; authority = '38 CFR 3.310'; likelihood = 'Medium' }
        'diabetes' = @{ pathway = 'Agent Orange Presumptive'; authority = '38 CFR 3.307(a)(6)'; likelihood = 'High' }
        'hypertension' = @{ pathway = 'Agent Orange (if IHD)'; authority = '38 CFR 3.307(a)(6)'; likelihood = 'Medium' }
        'back pain' = @{ pathway = 'Direct Service Connection'; authority = '38 CFR 3.303'; likelihood = 'Medium' }
        'knee pain' = @{ pathway = 'Direct Service Connection'; authority = '38 CFR 3.303'; likelihood = 'Medium' }
        'migraine' = @{ pathway = 'Secondary to TBI/PTSD'; authority = '38 CFR 3.310'; likelihood = 'Medium' }
        'TBI' = @{ pathway = 'Combat Injury'; authority = '38 CFR 3.303'; likelihood = 'High' }
        'depression' = @{ pathway = 'Mental Health - Combat'; authority = '38 CFR 3.304'; likelihood = 'High' }
        'anxiety' = @{ pathway = 'Mental Health - Service Related'; authority = '38 CFR 3.304'; likelihood = 'High' }
    }

    foreach ($condition in $ExtractedData.conditions) {
        $conditionName = $condition.name.ToLower()
        $pathway = $null
        
        # Check for exact or partial match
        foreach ($key in $presumptiveMappings.Keys) {
            if ($conditionName -match [regex]::Escape($key)) {
                $pathway = $presumptiveMappings[$key]
                break
            }
        }

        if ($pathway) {
            $opportunities += @{
                condition = $condition.name
                pathway = $pathway.pathway
                authority = $pathway.authority
                likelihood = $pathway.likelihood
                context = $condition.context
                evidenceStrength = if ($condition.context -eq 'documented') { 'Strong' } else { 'Moderate' }
                nextSteps = "File VA Form 21-526EZ; request C&P exam; gather service records"
            }
        } else {
            # Generic direct service connection
            $opportunities += @{
                condition = $condition.name
                pathway = 'Direct Service Connection'
                authority = '38 CFR 3.303'
                likelihood = 'Medium'
                context = $condition.context
                evidenceStrength = 'Requires nexus evidence'
                nextSteps = "Obtain nexus letter from physician linking condition to service"
            }
        }
    }

    # Check chronicity (multiple encounters over time)
    $chronicity = $false
    if ($ExtractedData.encounters.Count -ge 3) {
        $chronicity = $true
    }

    # Check continuity of care (ongoing treatment)
    $continuity = $false
    if ($ExtractedData.medications.Count -ge 2 -or $ExtractedData.procedures.Count -ge 2) {
        $continuity = $true
    }

    # Generate overall assessment
    $assessment = @{
        totalOpportunities = $opportunities.Count
        highLikelihood = ($opportunities | Where-Object { $_.likelihood -eq 'High' }).Count
        mediumLikelihood = ($opportunities | Where-Object { $_.likelihood -eq 'Medium' }).Count
        chronicConditions = $chronicity
        continuousCare = $continuity
        recommendation = if ($opportunities.Count -gt 0) { 
            "Veteran has $($opportunities.Count) potential service connection pathways. Recommend immediate claim filing."
        } else {
            "No clear service connection opportunities identified. Review service records for additional evidence."
        }
    }

    return @{
        status = "analyzed"
        module = "Analyzer.psm1"
        opportunities = $opportunities
        chronicity = $chronicity
        continuity = $continuity
        assessment = $assessment
        conditionsAnalyzed = $ExtractedData.conditions.Count
    }
}

Export-ModuleMember -Function Invoke-StrsAnalyzer
