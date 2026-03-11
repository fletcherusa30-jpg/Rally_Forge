<# DEPRECATED — modules/Output.psm1
===========================================================
 DEPRECATION NOTICE:
   Logic migrated to: engine/exporters/json_exporter.psm1
   Do not modify. Retained for fallback until validation completes.
   Migration date: March 9, 2026
===========================================================
#>

<# Output.psm1
STRS Output Module - Handles formatting and writing of final JSON output.
#>

function Invoke-StrsOutput {
    param([object]$AnalyzedData, [string]$OutputPath)
    # Placeholder implementation
    # Format analyzed data into structured JSON output
    $output = @{
        conditions = $AnalyzedData.conditions
        medications = $AnalyzedData.medications
        encounters = $AnalyzedData.encounters
        analysis = $AnalyzedData.analysis
        meta = @{
            source_type = "strs_scanner"
            generated_at = (Get-Date).ToString("o")
        }
    }
    
    if ($OutputPath) {
        $json = $output | ConvertTo-Json -Depth 10
        Set-Content -Path $OutputPath -Value $json -Encoding UTF8
        return @{ status = "written"; path = $OutputPath }
    } else {
        return $output
    }
}

Export-ModuleMember -Function Invoke-StrsOutput
