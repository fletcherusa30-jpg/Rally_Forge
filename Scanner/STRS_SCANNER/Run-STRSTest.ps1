param([string]\STRS.Output.ps1 = "sample_str.txt")

. "C:\Dev\Rally Forge\Scanner\STRS_SCANNER\STRS.Regex.ps1"
. "C:\Dev\Rally Forge\Scanner\STRS_SCANNER\STRS.PageDetector.ps1"
. "C:\Dev\Rally Forge\Scanner\STRS_SCANNER\STRS.DateDetector.ps1"
. "C:\Dev\Rally Forge\Scanner\STRS_SCANNER\STRS.Parser.ps1"
. "C:\Dev\Rally Forge\Scanner\STRS_SCANNER\STRS.Output.ps1"

\ = Get-Content (Join-Path "C:\Dev\Rally Forge\Scanner\STRS_SCANNER" \STRS.Output.ps1)
\ = Parse-STRSContent -Lines \
Convert-STRSResultToJson -Result \
