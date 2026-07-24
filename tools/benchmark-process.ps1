[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [int]$ProcessId,
  [ValidateRange(5, 86400)]
  [int]$DurationSeconds = 600,
  [ValidateRange(250, 60000)]
  [int]$IntervalMilliseconds = 1000,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function Get-ProcessSnapshot {
  param([System.Diagnostics.Process]$Process, [datetime]$At, [timespan]$Cpu)

  $Process.Refresh()
  [pscustomobject]@{
    at_utc = $At.ToUniversalTime().ToString('o')
    cpu_seconds = [math]::Round($Cpu.TotalSeconds, 3)
    working_set_bytes = $Process.WorkingSet64
    private_bytes = $Process.PrivateMemorySize64
    handles = $Process.HandleCount
    threads = $Process.Threads.Count
  }
}

$process = Get-Process -Id $ProcessId -ErrorAction Stop
$startedAt = [datetime]::UtcNow
$startedCpu = $process.TotalProcessorTime
$samples = [System.Collections.Generic.List[object]]::new()

try {
  while ($true) {
    $now = [datetime]::UtcNow
    $elapsed = ($now - $startedAt).TotalSeconds
    $cpu = $process.TotalProcessorTime - $startedCpu
    $samples.Add((Get-ProcessSnapshot -Process $process -At $now -Cpu $cpu))
    if ($elapsed -ge $DurationSeconds) { break }
    Start-Sleep -Milliseconds $IntervalMilliseconds
  }
}
catch [System.ArgumentException] {
  throw "Process $ProcessId exited before the benchmark completed."
}
catch [System.InvalidOperationException] {
  # TotalProcessorTime/Refresh can race with a process that exits between samples. Treat that
  # exactly like the existing missing-process case instead of emitting a partial report.
  throw "Process $ProcessId exited before the benchmark completed."
}
catch [System.ComponentModel.Win32Exception] {
  # Windows can report a process disappearing as a Win32 lookup failure. A partial sample is not
  # comparable, so fail closed with the same operator-facing message.
  throw "Process $ProcessId exited before the benchmark completed."
}

if ($samples.Count -eq 0) {
  throw 'No process samples were collected.'
}

$workingSet = @($samples | ForEach-Object { [double]$_.working_set_bytes })
$cpuSeconds = @($samples | ForEach-Object { [double]$_.cpu_seconds })
$wallSeconds = ([datetime]$samples[-1].at_utc - [datetime]$samples[0].at_utc).TotalSeconds
$cpuPercent = if ($wallSeconds -gt 0) {
  (($cpuSeconds[-1] - $cpuSeconds[0]) / $wallSeconds) * 100 / [Environment]::ProcessorCount
} else { 0 }

$result = [pscustomobject]@{
  schema_version = 1
  process_id = $ProcessId
  duration_seconds = [math]::Round($wallSeconds, 3)
  logical_processors = [Environment]::ProcessorCount
  summary = [pscustomobject]@{
    working_set_avg_mb = [math]::Round((($workingSet | Measure-Object -Average).Average / 1MB), 2)
    working_set_peak_mb = [math]::Round((($workingSet | Measure-Object -Maximum).Maximum / 1MB), 2)
    cpu_avg_percent = [math]::Round($cpuPercent, 2)
  }
  samples = @($samples)
}

$parent = Split-Path -Parent $OutputPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) {
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output "Wrote process benchmark to $OutputPath"
