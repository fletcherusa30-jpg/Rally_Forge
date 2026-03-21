param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$AuditResults = "audit_results.json",
  [string]$OutputPlan = "cleanup_plan.md",
  [string]$OutputQueue = "cleanup_approval_queue.md"
)

$ErrorActionPreference = "Stop"
$auditPath = Join-Path $RepoRoot $AuditResults
if (-not (Test-Path $auditPath)) {
  throw "Missing $AuditResults. Run scripts/full_system_audit.ps1 first."
}

$audit = Get-Content -Path $auditPath -Raw | ConvertFrom-Json

$lines = @(
  '# Rally Forge Cleanup Plan',
  '',
  "Generated: $((Get-Date).ToString('o'))",
  '',
  '## 1. Summary',
  "- Placeholder/TODO/stub hits: $($audit.findings.placeholderTodoStubHits)",
  "- Commented required code hits: $($audit.findings.commentedRequiredCodeHits)",
  "- Possible unused files (heuristic): $($audit.findings.possibleUnusedFiles.Count)",
  "- Markdown files: $($audit.inventory.markdownFiles)",
  '',
  '## 2. Priority Fixes',
  '- P0: Remove or resolve placeholders/TODO/stub logic in runtime paths.',
  '- P0: Resolve route-layer business logic concentration in scanner and health surfaces.',
  '- P1: Consolidate documentation into canonical MD files set.',
  '- P1: Reduce duplicate scanner/engine service surfaces.',
  '- P2: Archive redundant reports and placeholder-only directories.',
  '',
  '## 3. Possible Unused Files (Heuristic)',
  ''
)

foreach ($candidate in $audit.findings.possibleUnusedFiles) {
  $lines += "- $candidate"
}

$lines += ''
$lines += '## 4. Folder Structure Corrections'
$lines += "- Missing top-level folders: $([string]::Join(', ', $audit.findings.folderStructureDrift.missingTopLevel))"
$lines += "- Extra top-level folders: $([string]::Join(', ', $audit.findings.folderStructureDrift.extraTopLevel))"

$lines += ''
$lines += '## 5. MD Consolidation Targets'
$lines += '- Consolidate to MD_CONSOLIDATED/architecture.md, workflows.md, engines.md, scanners.md, services.md, ui.md, backend.md, benefits.md, knowledge.md, resources.md, modernization.md'

$lines += ''
$lines += '## 6. Approval-Required Actions'
$lines += '- File deletions (unused/obsolete)'
$lines += '- File moves/merges for blueprint alignment'
$lines += '- Any breaking route or service refactors'

Set-Content -Path (Join-Path $RepoRoot $OutputPlan) -Value ($lines -join "`n") -Encoding UTF8

$queueLines = @(
  '# Cleanup Approval Queue',
  '',
  "Generated: $((Get-Date).ToString('o'))",
  '',
  '## Non-Destructive Phase (Ready)',
  '- [ ] Normalize generated report paths and script output formatting',
  '- [ ] Refresh audit artifacts after each significant merge',
  '- [ ] Track unresolved TODO/placeholder markers by owner',
  '',
  '## Approval-Gated Destructive Phase (Pending Explicit Approval)',
  '- [ ] Delete redundant language service placeholder README files under services/*',
  '- [ ] Archive legacy duplicate markdown reports after canonical mapping is accepted',
  '- [ ] Move deprecated one-off root reports into an approved archive location',
  '',
  '## Change Control Requirements',
  '- Each destructive action requires explicit user approval and a pre/post file manifest.',
  '- Apply changes in small batches and rerun audit:command-center after each batch.',
  '- Do not perform branch-wide mass deletions in a single step.',
  '',
  '## Candidate Files Awaiting Approval',
  ''
)

foreach ($candidate in $audit.findings.possibleUnusedFiles) {
  $queueLines += "- [ ] $candidate"
}

Set-Content -Path (Join-Path $RepoRoot $OutputQueue) -Value ($queueLines -join "`n") -Encoding UTF8
Write-Output "Cleanup plan generated: $OutputPlan"
