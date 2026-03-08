<#
===========================================================
 STRS.PageDetector.ps1 — Page Number Detection
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
