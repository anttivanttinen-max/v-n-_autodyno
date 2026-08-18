$ErrorActionPreference = 'Stop'

$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'MotoLab_Zeel_Standalone.ino') -Raw
$failures = [System.Collections.Generic.List[string]]::new()

if ($source -notmatch 'static constexpr bool writeUnlocked = false;') {
    $failures.Add('Permanent write lock is missing.')
}
if ($source -match 'UNLOCK_WRITE|I_ACCEPT_RISK') {
    $failures.Add('A write-unlock command is present.')
}
if ($source -notmatch '0x61, 0xF0, 0x01' -or
    $source -notmatch '0x61, 0x00, 0x00' -or
    $source -notmatch '0x64') {
    $failures.Add('One or more read-only Zeeltronic commands are missing.')
}
if ($source -match '(?i)program[_ -]?cdi|write[_ -]?settings') {
    $failures.Add('A programming endpoint or command appears to be present.')
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host 'PASS: firmware is permanently read-only and contains only the expected read command family.'
