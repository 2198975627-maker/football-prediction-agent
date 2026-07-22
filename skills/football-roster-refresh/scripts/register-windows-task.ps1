[CmdletBinding()]
param(
  [string]$TaskName = "FootballRosterRefreshDaily",
  [string]$ProjectRoot = "",
  [ValidatePattern("^\d{2}:\d{2}$")]
  [string]$At = "00:00"
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot "..\..\..")).Path
}

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$runner = Join-Path $scriptRoot "run-refresh.ps1"
$taskTime = [datetime]::ParseExact($At, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -ProjectRoot `"$resolvedProjectRoot`""

if (-not (Test-Path -LiteralPath $runner)) {
  throw "Task runner was not found: $runner"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument $arguments `
  -WorkingDirectory $resolvedProjectRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $taskTime
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Refresh football roster and player data cache daily at Beijing midnight." `
  -Force | Out-Null

Get-ScheduledTask -TaskName $TaskName
