<#
===========================================================
 STRS.DateDetector.ps1 — Date Extraction
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
