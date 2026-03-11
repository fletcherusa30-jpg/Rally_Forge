<#
===========================================================
 DEPRECATED — STRS.DateDetector.ps1
===========================================================
 DEPRECATION NOTICE:
   Logic migrated to: engine/parsers/text_parser.psm1::Get-DateMatches
   Do not modify. Retained for fallback until validation completes.
   Migration date: March 9, 2026
   Replacement function: Get-DateMatches
===========================================================
#>

function Get-STRSNearestDate {
    param(
        [string[]],
        [int]
    )

    for ( = ;  -ge 0; --) {
        foreach ( in @{Diagnosis=System.Object[]; Symptom=System.Object[]; Event=System.Object[]; Date=System.Object[]; Page=System.Object[]}.Date) {
            if ([] -match ) {
                return [0]
            }
        }
    }

    return 
}
