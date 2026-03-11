<#
===========================================================
 DEPRECATED — STRS.PageDetector.ps1
===========================================================
 DEPRECATION NOTICE:
   Logic migrated to: engine/parsers/text_parser.psm1::Get-PageMarkers
   Do not modify. Retained for fallback until validation completes.
   Migration date: March 9, 2026
   Replacement function: Get-PageMarkers
===========================================================
#>

function Get-STRSPageNumber {
    param([string])

    foreach ( in @{Diagnosis=System.Object[]; Symptom=System.Object[]; Event=System.Object[]; Date=System.Object[]; Page=System.Object[]}.Page) {
        if ( -match ) {
            return ( -replace '[^\d]', '')
        }
    }

    return 
}
