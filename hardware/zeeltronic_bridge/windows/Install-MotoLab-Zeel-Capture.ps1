param(
  [string]$InstallDir = "$env:LOCALAPPDATA\MotoLab\ZeelCapture",
  [switch]$NoShortcut
)

$ErrorActionPreference='Stop'
$src=Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force $InstallDir|Out-Null
Copy-Item (Join-Path $src 'MotoLab-Zeel-Capture.ps1') $InstallDir -Force
Copy-Item (Join-Path $src 'Analyze-ZeelCapture.ps1') $InstallDir -Force
Copy-Item (Join-Path $src 'README.md') $InstallDir -Force -ErrorAction SilentlyContinue

$launcher=Join-Path $InstallDir 'Start-MotoLab-Zeel-Capture.cmd'
@"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\MotoLab\ZeelCapture\MotoLab-Zeel-Capture.ps1"
"@ | Set-Content -Encoding ASCII $launcher

if(-not $NoShortcut){
  $desktop=[Environment]::GetFolderPath('Desktop')
  $lnk=Join-Path $desktop 'MotoLab Zeel Capture.lnk'
  $ws=New-Object -ComObject WScript.Shell
  $s=$ws.CreateShortcut($lnk)
  $s.TargetPath=$launcher
  $s.WorkingDirectory=$InstallDir
  $s.Description='MotoLab Zeel Capture'
  $s.Save()
}

$data="$env:USERPROFILE\Documents\MotoLab\ZeelCapture"
New-Item -ItemType Directory -Force $data|Out-Null

Write-Host "MotoLab Zeel Capture asennettu: $InstallDir"
Write-Host "Data: $data"
Write-Host ''
Write-Host 'Virtuaali-COM huomio:'
Write-Host 'ZeelProg-proxy tarvitsee Windowsiin erillisen virtuaalisen COM-porttiparin. Sovellus tunnistaa valmiin parin, mutta ei asenna kernel-ajuria automaattisesti.'
Write-Host 'READ-ONLY direct capture toimii ilman virtuaali-COM-ajuria.'
