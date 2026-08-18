param([string]$BaseDir="$env:USERPROFILE\Documents\MotoLab\ZeelCapture")
$ErrorActionPreference='Stop'
Write-Host 'MotoLab Zeel Proxy prerequisite check'
Write-Host '------------------------------------'
$ports=Get-PnpDevice -Class Ports -PresentOnly -ErrorAction SilentlyContinue
$virtual=@($ports | Where-Object { $_.FriendlyName -match 'com0com|CNCA|CNCB|Virtual' })
if($virtual.Count -ge 2){
 Write-Host 'Virtual COM pair appears to be installed:' -ForegroundColor Green
 $virtual | ForEach-Object { Write-Host ('  '+$_.FriendlyName) }
 Write-Host 'No driver changes were made.'
 exit 0
}
Write-Host 'No virtual COM pair detected.' -ForegroundColor Yellow
Write-Host 'MotoLab will not silently install a kernel driver.'
Write-Host 'Install a trusted signed virtual COM-pair driver, then rerun this check.'
Write-Host 'After two virtual COM ports exist, Zeel Capture can proxy ZeelProg traffic.'
exit 2
