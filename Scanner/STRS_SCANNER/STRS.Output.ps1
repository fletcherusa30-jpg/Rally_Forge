<#
===========================================================
 DEPRECATED — STRS.Output.ps1
===========================================================
 DEPRECATION NOTICE:
   Logic migrated to: engine/exporters/json_exporter.psm1
   Do not modify. Retained for fallback until validation completes.
   Migration date: March 9, 2026
   Replacement functions:
     - Export-STRSToJson
     - Export-STRSToJsonFile
     - Validate-STRSStructure
===========================================================
#>

function Convert-STRSResultToJson {
    param([hashtable])

    return ( | ConvertTo-Json -Depth 10)
}
