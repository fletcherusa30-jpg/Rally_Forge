<#
===========================================================
 STRS.Parser.ps1 — Extraction Engine
===========================================================
#>

function Parse-STRSContent {
    param([string[]])

     = @{
        diagnoses = @()
        symptoms  = @()
        events    = @()
        parse_warnings = @()
    }

     = 1

    for ( = 0;  -lt .Count; ++) {
         = []

        # Page detection
         = Get-STRSPageNumber -Line 
        if () {  = [int] }

        # Check each category
        foreach ( in @{Diagnosis=System.Object[]; Symptom=System.Object[]; Event=System.Object[]; Date=System.Object[]; Page=System.Object[]}.Diagnosis) {
            if ( -match ) {
                .diagnoses += @{
                    type = "diagnosis"
                    text = .Trim()
                    page = 
                    date = Get-STRSNearestDate -Lines  -Index 
                    source_line = 
                }
            }
        }

        foreach ( in @{Diagnosis=System.Object[]; Symptom=System.Object[]; Event=System.Object[]; Date=System.Object[]; Page=System.Object[]}.Symptom) {
            if ( -match ) {
                .symptoms += @{
                    type = "symptom"
                    text = .Trim()
                    page = 
                    date = Get-STRSNearestDate -Lines  -Index 
                    source_line = 
                }
            }
        }

        foreach ( in @{Diagnosis=System.Object[]; Symptom=System.Object[]; Event=System.Object[]; Date=System.Object[]; Page=System.Object[]}.Event) {
            if ( -match ) {
                .events += @{
                    type = "event"
                    text = .Trim()
                    page = 
                    date = Get-STRSNearestDate -Lines  -Index 
                    source_line = 
                }
            }
        }
    }

    return 
}
