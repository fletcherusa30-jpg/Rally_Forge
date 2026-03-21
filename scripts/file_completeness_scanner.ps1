param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$OutputJson = "file_completeness_report.json",
  [string]$OutputMarkdown = "file_completeness_report.md"
)

$ErrorActionPreference = "Stop"
$excludedDirPattern = "(\\|/)(node_modules|\.git|dist|build|coverage|tmp|cache|logs)(\\|/)"
$scanExtensions = @('.js','.jsx','.ts','.tsx','.mjs','.cjs','.ps1')
$excludedFilePattern = '(audit_results\.json|audit_summary\.md|cleanup_plan\.md|file_completeness_report\.(json|md)|final_verification_report\.md|folder_alignment_plan\.md|md_consolidation_report\.md)$'
$patterns = [ordered]@{
  todo = 'TODO'
  fixme = 'FIXME'
  placeholder = 'placeholder'
  stub = '\bstub\b'
  incomplete = 'not implemented|NotImplemented|TBD'
}

$files = Get-ChildItem -Path $RepoRoot -Recurse -File | Where-Object {
  $_.FullName -notmatch $excludedDirPattern -and
  $_.Extension -in $scanExtensions -and
  $_.FullName -notmatch $excludedFilePattern
}

$hits = @()
foreach ($file in $files) {
  $raw = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrEmpty($raw)) { continue }

  foreach ($entry in $patterns.GetEnumerator()) {
    if ($raw -match $entry.Value) {
      $hits += [PSCustomObject]@{
        path = $file.FullName.Substring($RepoRoot.Length + 1).Replace('\\','/')
        category = $entry.Key
      }
    }
  }
}

$grouped = $hits | Group-Object -Property category | Sort-Object Name
$result = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  totalFilesScanned = $files.Count
  totalHits = $hits.Count
  countsByCategory = @{}
  hitSamples = $hits | Select-Object -First 100
}

foreach ($group in $grouped) {
  $result.countsByCategory[$group.Name] = $group.Count
}

$result | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $RepoRoot $OutputJson) -Encoding UTF8

$lines = @(
  '# File Completeness Report',
  '',
  "Generated: $($result.generatedAt)",
  '',
  "- Files scanned: $($result.totalFilesScanned)",
  "- Total marker hits: $($result.totalHits)",
  '',
  '## Counts by Category'
)

foreach ($group in $grouped) {
  $lines += "- $($group.Name): $($group.Count)"
}

$lines += ''
$lines += '## Sample Hits'
foreach ($sample in ($hits | Select-Object -First 30)) {
  $lines += "- [$($sample.category)] $($sample.path)"
}

Set-Content -Path (Join-Path $RepoRoot $OutputMarkdown) -Value ($lines -join "`n") -Encoding UTF8
Write-Output "Completeness scan complete: $OutputJson, $OutputMarkdown"
