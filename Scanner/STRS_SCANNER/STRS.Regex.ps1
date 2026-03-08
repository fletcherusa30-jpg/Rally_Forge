<#
===========================================================
 STRS.Regex.ps1 — Regex Library
===========================================================
#>

@{Diagnosis=System.Object[]; Symptom=System.Object[]; Event=System.Object[]; Date=System.Object[]; Page=System.Object[]} = [PSCustomObject]@{
    Diagnosis = @(
        '\bdiagnosed with\b',
        '\bdiagnosis\b',
        '\bDx[: ]\b',
        '\bassessed as\b'
    )

    Symptom = @(
        '\bpain\b',
        '\bsoreness\b',
        '\bcomplains of\b',
        '\breports\b',
        '\bsymptoms?\b'
    )

    Event = @(
        '\binjury\b',
        '\baccident\b',
        '\bfell\b',
        '\bimpact\b',
        '\btrauma\b'
    )

    Date = @(
        '\b\d{1,2}/\d{1,2}/\d{2,4}\b',
        '\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b',
        '\b\d{4}\b'
    )

    Page = @(
        'Page\s+\d+',
        'Pg\.\s*\d+',
        'P\.\s*\d+'
    )
}
