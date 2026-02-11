Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Move-IfPresent([string]$SourcePath, [string]$DestinationDir) {
    if (Test-Path -LiteralPath $SourcePath) {
        Ensure-Directory $DestinationDir
        $leaf = Split-Path -Path $SourcePath -Leaf
        $destinationPath = Join-Path -Path $DestinationDir -ChildPath $leaf
        Move-Item -LiteralPath $SourcePath -Destination $destinationPath -Force
    }
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Lighthouse integration
$lighthouseSource = Join-Path $repoRoot 'src\lighthouse'
$lighthouseDest = Join-Path $repoRoot 'packages\lighthouse\src'
$lhFiles = @(
    'lighthouse_client.js',
    'oauth_client.js',
    'token_manager.js',
    'mock_endpoints.js',
    'mock_lighthouse_client.js',
    'mock_oauth_flow.js',
    'mock_scopes.js'
)
foreach ($file in $lhFiles) {
    Move-IfPresent (Join-Path $lighthouseSource $file) $lighthouseDest
}

# Shared domain data
$sharedDest = Join-Path $repoRoot 'packages\shared-data\src\constants'
$sharedMoves = @(
    (Join-Path $repoRoot 'shared\constants\states.js'),
    (Join-Path $repoRoot 'shared\constants\awardsList.js'),
    (Join-Path $repoRoot 'shared\constants\branches.js'),
    (Join-Path $repoRoot 'shared\constants\separationCodesData.js'),
    (Join-Path $repoRoot 'shared\schemas\onboardingSchema.js'),
    (Join-Path $repoRoot 'shared\types\onboarding.js')
)
foreach ($sourcePath in $sharedMoves) {
    Move-IfPresent $sourcePath $sharedDest
}
