param()
\ = Split-Path -Parent \System.Management.Automation.InvocationInfo.MyCommand.Path
& (Join-Path \ '..\orchestrate-ai.ps1') -ScannerJson '..\output\sample_str.json' -AiOutput '..\output\ai_analysis.json'
if (-not (Test-Path (Join-Path \ '..\output\ai_analysis.json'))) { Write-Host 'Test failed: AI output not created'; exit 1 }
Write-Host 'Test completed: AI output created (placeholder or validated).'

