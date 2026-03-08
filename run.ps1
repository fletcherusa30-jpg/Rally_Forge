param(
  [string]$Root = "C:\Dev\Rally Forge"
)

$ErrorActionPreference = "Stop"
$MasterLog = Join-Path $Root "run-master-log.txt"

function Write-Master {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $MasterLog -Value $line
  Write-Host $line
}

Add-Content -Path $MasterLog -Value "`n========== RUN MASTER START $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =========="

Write-Master "Starting Rally Forge canonical services (VA SCANNER + STRS_SCANNER stack)..."

Push-Location $Root
try {
  Write-Master "Running npm run dev"
  npm run dev
  $exitCode = $LASTEXITCODE

  if ($exitCode -eq 0) {
    Write-Master "RUN RESULT: PASS"
    Add-Content -Path $MasterLog -Value "========== RUN MASTER END $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==========`n"
    exit 0
  }

  Write-Master "RUN RESULT: FAIL (npm run dev exited with code $exitCode)"
  Add-Content -Path $MasterLog -Value "========== RUN MASTER END $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==========`n"
  exit $exitCode
}
finally {
  Pop-Location
}

