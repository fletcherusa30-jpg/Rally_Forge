param(
  [string]$Root = "C:\Dev\Rally Forge",
  [ValidateSet("Dev", "Watchdog", "NightlyAudit", "ScheduleNightlyAudit")]
  [string]$Mode = "Dev",
  [int]$IntervalMinutes = 15
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
  switch ($Mode) {
    "Dev" {
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

    "Watchdog" {
      Write-Master "Starting WATCHDOG loop with interval ${IntervalMinutes} minutes"
      while ($true) {
        Write-Master "WATCHDOG: Running npm run audit:watchdog:once"
        npm run audit:watchdog:once
        $exitCode = $LASTEXITCODE

        if ($exitCode -ne 0) {
          Write-Master "WATCHDOG: FAIL (exit code $exitCode)"
        }
        else {
          Write-Master "WATCHDOG: PASS"
        }

        Write-Master "WATCHDOG: Sleeping for ${IntervalMinutes} minute(s)"
        Start-Sleep -Seconds ($IntervalMinutes * 60)
      }
    }

    "NightlyAudit" {
      Write-Master "Running nightly audit cycle (npm run audit:nightly)"
      npm run audit:nightly
      $exitCode = $LASTEXITCODE

      if ($exitCode -eq 0) {
        Write-Master "NIGHTLY AUDIT: PASS"
      }
      else {
        Write-Master "NIGHTLY AUDIT: FAIL (exit code $exitCode)"
      }

      Add-Content -Path $MasterLog -Value "========== RUN MASTER END $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==========`n"
      exit $exitCode
    }

    "ScheduleNightlyAudit" {
      $taskName = "RallyForgeNightlyAudit"
      $launcherDir = Join-Path $env:ProgramData "RallyForge"
      $launcherPath = Join-Path $launcherDir "nightly-audit.cmd"
      if (-not (Test-Path $launcherDir)) {
        New-Item -Path $launcherDir -ItemType Directory -Force | Out-Null
      }

      $launcherContent = @(
        '@echo off'
        ('cd /d "{0}"' -f $Root)
        'npm run audit:nightly'
      ) -join "`r`n"
      Set-Content -Path $launcherPath -Value $launcherContent -Encoding Ascii

      $taskCommand = '"{0}"' -f $launcherPath
      Write-Master "Scheduling nightly audit task '$taskName' at 02:00 local time"
      schtasks /Create /SC DAILY /TN $taskName /TR $taskCommand /ST 02:00 /F | Out-Null
      $exitCode = $LASTEXITCODE
      if ($exitCode -eq 0) {
        Write-Master "Nightly audit task scheduled successfully"
      }
      else {
        Write-Master "Nightly audit task scheduling failed with exit code $exitCode"
      }

      Add-Content -Path $MasterLog -Value "========== RUN MASTER END $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==========`n"
      exit $exitCode
    }
  }
}
finally {
  Pop-Location
}

