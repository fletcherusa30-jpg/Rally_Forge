<#
===========================================================
 STRS.Output.ps1 — JSON Formatter
===========================================================
#>

function Convert-STRSResultToJson {
    param([hashtable])

    return ( | ConvertTo-Json -Depth 10)
}
