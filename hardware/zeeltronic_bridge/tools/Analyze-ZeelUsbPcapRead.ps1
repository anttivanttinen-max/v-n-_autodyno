param(
  [Parameter(Mandatory=$true)][string]$PcapPath,
  [string]$OutputDir = '',
  [double]$ClusterGapSeconds = 0.5,
  [string]$TsharkPath = 'C:\Program Files\Wireshark\tshark.exe'
)

$ErrorActionPreference = 'Stop'

function Convert-HexToBytes([string]$Hex) {
  if ([string]::IsNullOrEmpty($Hex)) { return [byte[]]@() }
  if (($Hex.Length % 2) -ne 0) { throw "Odd-length hex string: $($Hex.Length)" }
  $bytes = New-Object byte[] ($Hex.Length / 2)
  for ($i = 0; $i -lt $bytes.Length; $i++) {
    $bytes[$i] = [Convert]::ToByte($Hex.Substring($i * 2, 2), 16)
  }
  return $bytes
}

function Get-Sha256Hex([byte[]]$Bytes) {
  if (-not $Bytes.Length) { return $null }
  $hash = [Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)
  return (($hash | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Get-FileSha256Hex([string]$Path) {
  $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
  try {
    $hash = [Security.Cryptography.SHA256]::Create().ComputeHash($stream)
    return (($hash | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally {
    $stream.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $PcapPath)) { throw "PCAP not found: $PcapPath" }
if (-not (Test-Path -LiteralPath $TsharkPath)) { throw "tshark not found: $TsharkPath" }
if (-not $OutputDir) { $OutputDir = Join-Path (Split-Path -Parent $PcapPath) ((Split-Path -LeafBase $PcapPath) + '_ftdi') }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$filter = 'ftdi-ft.if_a_rx_payload || ftdi-ft.if_a_tx_payload'
$lines = & $TsharkPath -r $PcapPath -Y $filter -T fields -E 'separator=|' `
  -e frame.number -e frame.time_epoch -e ftdi-ft.if_a_tx_payload -e ftdi-ft.if_a_rx_payload 2>$null
if ($LASTEXITCODE -ne 0) { throw "tshark failed with exit code $LASTEXITCODE" }

$events = foreach ($line in $lines) {
  $p = $line -split '\|', 4
  if ($p.Count -lt 4) { continue }
  [pscustomobject]@{
    frame = [int]$p[0]
    epoch = [double]::Parse($p[1], [Globalization.CultureInfo]::InvariantCulture)
    direction = if ($p[2]) { 'PC_TO_ZEEL' } else { 'ZEEL_TO_PC' }
    hex = if ($p[2]) { $p[2].ToLowerInvariant() } else { $p[3].ToLowerInvariant() }
  }
}
if (-not $events) { throw 'No FTDI interface-A payload events found.' }

$clusters = @()
$current = @()
$previous = $null
foreach ($event in $events) {
  if ($null -ne $previous -and ($event.epoch - $previous) -gt $ClusterGapSeconds) {
    if ($current.Count) { $clusters += ,@($current) }
    $current = @()
  }
  $current += ,$event
  $previous = $event.epoch
}
if ($current.Count) { $clusters += ,@($current) }

$summaries = @()
for ($i = 0; $i -lt $clusters.Count; $i++) {
  $cluster = $clusters[$i]
  $number = $i + 1
  $prefix = 'cluster_{0:D2}_frames_{1}-{2}' -f $number,$cluster[0].frame,$cluster[-1].frame
  $txHex = (($cluster | Where-Object direction -eq 'PC_TO_ZEEL').hex) -join ''
  $rxHex = (($cluster | Where-Object direction -eq 'ZEEL_TO_PC').hex) -join ''
  $tx = Convert-HexToBytes $txHex
  $rx = Convert-HexToBytes $rxHex
  [IO.File]::WriteAllBytes((Join-Path $OutputDir ($prefix + '_pc_to_zeel.bin')), $tx)
  [IO.File]::WriteAllBytes((Join-Path $OutputDir ($prefix + '_zeel_to_pc.bin')), $rx)
  $summaries += [ordered]@{
    cluster = $number
    start_frame = $cluster[0].frame
    end_frame = $cluster[-1].frame
    duration_seconds = [math]::Round($cluster[-1].epoch - $cluster[0].epoch, 6)
    event_count = $cluster.Count
    pc_to_zeel_bytes = $tx.Length
    zeel_to_pc_bytes = $rx.Length
    pc_to_zeel_sha256 = Get-Sha256Hex $tx
    zeel_to_pc_sha256 = Get-Sha256Hex $rx
  }
}

$result = [ordered]@{
  schema = 'motolab_zeel_usbpcap_analysis_v1'
  source_path = (Resolve-Path -LiteralPath $PcapPath).Path
  source_sha256 = Get-FileSha256Hex (Resolve-Path -LiteralPath $PcapPath).Path
  tshark_path = (Resolve-Path -LiteralPath $TsharkPath).Path
  cluster_gap_seconds = $ClusterGapSeconds
  clusters = $summaries
}
$result | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputDir 'analysis.json')
$result | ConvertTo-Json -Depth 6

