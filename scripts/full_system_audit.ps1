param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$OutputJson = "audit_results.json",
  [string]$OutputSummary = "audit_summary.md"
)

$ErrorActionPreference = "Stop"

$excludedDirPattern = "(\\|/)(node_modules|\.git|dist|build|coverage|tmp|cache|logs)(\\|/)"
$allFiles = Get-ChildItem -Path $RepoRoot -Recurse -File | Where-Object { $_.FullName -notmatch $excludedDirPattern }

$todoRegex = '(TODO|FIXME|TBD|placeholder|stub|not implemented|NotImplemented)'
$commentedRequiredRegex = '(^\s*//\s*(return|export|function|class)\b|^\s*/\*\s*(return|export|function|class)\b)'

$todoHits = @()
$commentedRequiredHits = @()
foreach ($file in $allFiles) {
  if ($file.Extension -notin @('.js','.jsx','.ts','.tsx','.mjs','.cjs','.md','.ps1','.json')) { continue }
  $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrEmpty($content)) { continue }

  if ($content -match $todoRegex) {
    $todoHits += [PSCustomObject]@{ path = $file.FullName.Substring($RepoRoot.Length + 1).Replace('\\','/'); marker = 'todo_placeholder_stub' }
  }
  if ($content -match $commentedRequiredRegex) {
    $commentedRequiredHits += [PSCustomObject]@{ path = $file.FullName.Substring($RepoRoot.Length + 1).Replace('\\','/'); marker = 'commented_required_code' }
  }
}

$mdFiles = $allFiles | Where-Object { $_.Extension -eq '.md' } | ForEach-Object { $_.FullName.Substring($RepoRoot.Length + 1).Replace('\\','/') }

$topLevel = Get-ChildItem -Path $RepoRoot -Directory | Select-Object -ExpandProperty Name
$expectedTopLevel = @('app','backend','knowledge','resources','tooling','scripts','docs','MD_CONSOLIDATED')
$optionalTopLevel = @('tests','TESTS_CONSOLIDATED')
$missingTopLevel = $expectedTopLevel | Where-Object { $_ -notin $topLevel }
$missingOptionalTopLevel = $optionalTopLevel | Where-Object { $_ -notin $topLevel }
$extraTopLevel = $topLevel | Where-Object { $_ -notin $expectedTopLevel }

$unusedHeuristic = @(
  'services/go/README.md',
  'services/python/README.md',
  'services/csharp/README.md',
  'services/rust/README.md',
  'knowledge/STATE_BENEFITS_LEGACY_ROOT/README.md'
) | Where-Object { Test-Path (Join-Path $RepoRoot $_) }

$results = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  repoRoot = $RepoRoot.Replace('\\','/')
  inventory = [ordered]@{
    totalFiles = $allFiles.Count
    markdownFiles = $mdFiles.Count
    backendFiles = ($allFiles | Where-Object { $_.FullName -match "\\backend\\" }).Count
    frontendFiles = ($allFiles | Where-Object { $_.FullName -match "\\app\\frontend-modern\\src\\" }).Count
  }
  findings = [ordered]@{
    placeholderTodoStubHits = $todoHits.Count
    commentedRequiredCodeHits = $commentedRequiredHits.Count
    possibleUnusedFiles = $unusedHeuristic
    mdSprawl = [ordered]@{
      total = $mdFiles.Count
      samples = $mdFiles | Select-Object -First 40
    }
    folderStructureDrift = [ordered]@{
      missingTopLevel = $missingTopLevel
      missingOptionalTopLevel = $missingOptionalTopLevel
      extraTopLevel = $extraTopLevel
    }
  }
}

$results | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $RepoRoot $OutputJson) -Encoding UTF8

$summary = @"
# Rally Forge Audit Summary

Generated: $($results.generatedAt)

## Inventory
- Total files scanned: $($results.inventory.totalFiles)
- Markdown files: $($results.inventory.markdownFiles)
- Backend files: $($results.inventory.backendFiles)
- Frontend files: $($results.inventory.frontendFiles)

## Findings
- Placeholder/TODO/stub hits: $($results.findings.placeholderTodoStubHits)
- Commented required-code hits: $($results.findings.commentedRequiredCodeHits)
- Possible unused files (heuristic): $($results.findings.possibleUnusedFiles.Count)

## Folder Structure Drift
- Missing top-level blueprint folders: $([string]::Join(', ', $results.findings.folderStructureDrift.missingTopLevel))
- Extra top-level folders: $([string]::Join(', ', $results.findings.folderStructureDrift.extraTopLevel))

## Next Step
Run scripts/cleanup_plan_generator.ps1 to produce cleanup_plan.md from audit_results.json.
"@

Set-Content -Path (Join-Path $RepoRoot $OutputSummary) -Value $summary.Replace('\\','/') -Encoding UTF8
Write-Output "Audit complete: $OutputJson, $OutputSummary"
