param(
    [string]$UsbPcapDevice = '\\.\USBPcap1',
    [string]$OutputDirectory = "$env:USERPROFILE\Documents\MotoLab\ZeelCapture",
    [string]$ToolPath,
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'
$toolCandidates = @(
    $ToolPath,
    (Join-Path $PSScriptRoot 'usbpcap_tool\USBPcapCMD.exe'),
    'C:\Program Files\USBPcap\USBPcapCMD.exe'
) | Where-Object { $_ }
$tool = $toolCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $tool -or -not (Test-Path -LiteralPath $tool)) {
    throw "USBPcapCMD puuttuu. Anna -ToolPath tai palauta USBPcap 1.5.4.0 -työkalu."
}

$existing = @(Get-Process USBPcapCMD -ErrorAction SilentlyContinue)
if ($existing.Count -gt 0 -and -not $Restart) {
    [pscustomobject]@{
        state = 'already_running'
        process_ids = @($existing.Id)
        note = 'Use -Restart only when a fresh capture file is required.'
    } | ConvertTo-Json -Depth 3
    exit 0
}

if ($Restart) {
    $existing | Stop-Process -Force
    Start-Sleep -Milliseconds 300
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$capturePath = Join-Path $OutputDirectory "zeel_usb_$stamp.pcapng"
$captureArgs = @('-d', $UsbPcapDevice, '-o', $capturePath, '-A', '--inject-descriptors')
$process = Start-Process -FilePath $tool -ArgumentList $captureArgs -Verb RunAs -PassThru
Start-Sleep -Seconds 3

if ($process.HasExited) {
    throw "USBPcapCMD pysähtyi heti (exit $($process.ExitCode)). Tarkista USBPcap-root ja järjestelmänvalvojan hyväksyntä."
}

[pscustomobject]@{
    state = 'running'
    process_id = $process.Id
    usbpcap_device = $UsbPcapDevice
    capture_path = $capturePath
    file_exists = Test-Path -LiteralPath $capturePath
    safety = 'passive USB capture; no CDI commands generated'
} | ConvertTo-Json -Depth 3
