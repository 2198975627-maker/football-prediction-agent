[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [string]$Output = "data\football-rosters",
  [int]$MaxTeams = 120,
  [int]$MaxPlayersPerTeam = 80,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot "..\..\..")).Path
}

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$refreshScript = Join-Path $resolvedProjectRoot "skills\football-roster-refresh\scripts\refresh-rosters.mjs"
$logDir = Join-Path $resolvedProjectRoot "data\football-rosters\logs"
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $logDir "refresh-$stamp.log"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found in PATH. Install Node.js or run this script from the Codex project shell."
}

if (-not (Test-Path -LiteralPath $refreshScript)) {
  throw "Roster refresh script was not found: $refreshScript"
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location -LiteralPath $resolvedProjectRoot

$arguments = @(
  $refreshScript,
  "--output",
  $Output,
  "--max-teams",
  "$MaxTeams",
  "--max-players-per-team",
  "$MaxPlayersPerTeam"
)

if ($DryRun) {
  $arguments += "--dry-run"
}

Write-Host "[football-roster-refresh] project=$resolvedProjectRoot"
Write-Host "[football-roster-refresh] output=$Output"
Write-Host "[football-roster-refresh] log=$logFile"

$stdoutFile = Join-Path $env:TEMP "football-roster-refresh-$stamp.out.log"
$stderrFile = Join-Path $env:TEMP "football-roster-refresh-$stamp.err.log"

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
try {
  & node @arguments 1> $stdoutFile 2> $stderrFile
  $exitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
  $commandOutput = @()
  if (Test-Path -LiteralPath $stdoutFile) {
    $commandOutput += Get-Content -LiteralPath $stdoutFile
    Remove-Item -LiteralPath $stdoutFile -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $stderrFile) {
    $commandOutput += Get-Content -LiteralPath $stderrFile
    Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
  }
}

$commandOutput | Tee-Object -FilePath $logFile

if ($exitCode -ne 0) {
  Write-Error "Roster refresh failed with exit code $exitCode. See $logFile"
  exit $exitCode
}

Write-Host "[football-roster-refresh] completed"
