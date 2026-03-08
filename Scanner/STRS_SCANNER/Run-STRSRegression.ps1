Write-Host "Running STRS Regression Suite..." -ForegroundColor Cyan

.\Run-STRSTest.ps1 | Out-File "C:\Dev\Rally Forge\Scanner\STRS_SCANNER\regression_output.json"

Write-Host "Regression complete. Output saved to regression_output.json" -ForegroundColor Green
