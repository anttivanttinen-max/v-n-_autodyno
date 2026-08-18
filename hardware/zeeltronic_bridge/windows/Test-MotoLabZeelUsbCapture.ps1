param(
    [string]$CaptureDirectory = "$env:USERPROFILE\Documents\MotoLab\ZeelCapture"
)

$ErrorActionPreference = 'Stop'
$process = @(Get-Process USBPcapCMD -ErrorAction SilentlyContinue)
$latest = Get-ChildItem -LiteralPath $CaptureDirectory -Filter '*.pcapng' -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

[pscustomobject]@{
    running = $process.Count -gt 0
    process_ids = @($process.Id)
    latest_capture = if ($latest) { $latest.FullName } else { $null }
    latest_size = if ($latest) { $latest.Length } else { 0 }
    latest_write_utc = if ($latest) { $latest.LastWriteTimeUtc.ToString('o') } else { $null }
    note = 'Traffic validation requires the FTDI/CDI to be connected and one read-only Read operation.'
} | ConvertTo-Json -Depth 3
